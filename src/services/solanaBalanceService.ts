import { Connection, PublicKey, ParsedAccountData } from '@solana/web3.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SolanaBalanceResult {
  walletAddress: string;
  usdcBalance: number;
  solBalance: number;
  lastUpdated: Date;
  success: boolean;
  error?: string;
}

export interface TokenAccountInfo {
  mint: string;
  owner: string;
  state: string;
  tokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
  };
}

export class SolanaBalanceService {
  private static connection: Connection;
  private static readonly USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mainnet mint address
  private static readonly USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // USDC devnet mint address
  private static readonly LAMPORTS_PER_SOL = 1_000_000_000;

  /**
   * Initialize the service with Solana connection
   */
  public static initialize(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Fetch USDC balance from Solana blockchain for a wallet
   */
  public static async fetchUSDCBalance(walletAddress: string): Promise<{
    usdcBalance: number;
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.connection) {
        throw new Error('Connection not initialized. Call initialize() first.');
      }

      const walletPublicKey = new PublicKey(walletAddress);
      
      // Get all token accounts for the wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') // SPL Token Program
        }
      );

      // Find USDC token account (check both mainnet and devnet mint addresses)
      let usdcBalance = 0;
      let usdcAccountFound = false;
      let networkType = 'unknown';

      for (const accountInfo of tokenAccounts.value) {
        const parsedData = accountInfo.account.data as ParsedAccountData;
        
        if (parsedData.parsed && parsedData.parsed.type === 'account') {
          const tokenInfo = parsedData.parsed.info as TokenAccountInfo;
          
          // Check if this is a USDC token account (mainnet or devnet)
          if (tokenInfo.mint === this.USDC_MAINNET_MINT) {
            usdcBalance = tokenInfo.tokenAmount.uiAmount || 0;
            usdcAccountFound = true;
            networkType = 'mainnet';
            console.log(`📊 Found mainnet USDC account: ${tokenInfo.tokenAmount.amount} raw amount, ${tokenInfo.tokenAmount.decimals} decimals, ${tokenInfo.tokenAmount.uiAmount} USDC`);
            break;
          } else if (tokenInfo.mint === this.USDC_DEVNET_MINT) {
            usdcBalance = tokenInfo.tokenAmount.uiAmount || 0;
            usdcAccountFound = true;
            networkType = 'devnet';
            console.log(`📊 Found devnet USDC account: ${tokenInfo.tokenAmount.amount} raw amount, ${tokenInfo.tokenAmount.decimals} decimals, ${tokenInfo.tokenAmount.uiAmount} USDC`);
            break;
          }
        }
      }

      // If no USDC token account found, balance is 0
      if (!usdcAccountFound) {
        console.log(`📊 No USDC token account found for wallet ${walletAddress.substring(0, 8)}...`);
        console.log(`   Checked for mainnet USDC: ${this.USDC_MAINNET_MINT}`);
        console.log(`   Checked for devnet USDC: ${this.USDC_DEVNET_MINT}`);
      } else {
        console.log(`💰 Fetched ${networkType} USDC balance for ${walletAddress.substring(0, 8)}...: ${usdcBalance} USDC`);
      }

      return {
        usdcBalance,
        success: true
      };

    } catch (error) {
      console.error(`❌ Error fetching USDC balance for ${walletAddress}:`, error);
      return {
        usdcBalance: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch SOL balance from Solana blockchain for a wallet
   */
  public static async fetchSOLBalance(walletAddress: string): Promise<{
    solBalance: number;
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.connection) {
        throw new Error('Connection not initialized. Call initialize() first.');
      }

      const walletPublicKey = new PublicKey(walletAddress);
      const lamports = await this.connection.getBalance(walletPublicKey);
      const solBalance = lamports / this.LAMPORTS_PER_SOL;

      console.log(`💰 Fetched SOL balance for ${walletAddress.substring(0, 8)}...: ${solBalance} SOL`);

      return {
        solBalance,
        success: true
      };

    } catch (error) {
      console.error(`❌ Error fetching SOL balance for ${walletAddress}:`, error);
      return {
        solBalance: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch both USDC and SOL balances from Solana blockchain
   */
  public static async fetchWalletBalances(walletAddress: string): Promise<SolanaBalanceResult> {
    const [usdcResult, solResult] = await Promise.all([
      this.fetchUSDCBalance(walletAddress),
      this.fetchSOLBalance(walletAddress)
    ]);

    return {
      walletAddress,
      usdcBalance: usdcResult.usdcBalance,
      solBalance: solResult.solBalance,
      lastUpdated: new Date(),
      success: usdcResult.success && solResult.success,
      error: usdcResult.error || solResult.error
    };
  }

  /**
   * Update user balance in database with blockchain data
   */
  public static async updateUserBalanceFromBlockchain(userId: number): Promise<{
    success: boolean;
    newBalance: number;
    error?: string;
  }> {
    try {
      // Get user with wallet address
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          email: true,
          solanaWallet: true,
          balance: true
        }
      });

      if (!user) {
        return {
          success: false,
          newBalance: 0,
          error: 'User not found'
        };
      }

      if (!user.solanaWallet) {
        return {
          success: false,
          newBalance: 0,
          error: 'User has no Solana wallet address'
        };
      }

      // Fetch USDC balance from blockchain
      const balanceResult = await this.fetchUSDCBalance(user.solanaWallet);

      if (!balanceResult.success) {
        return {
          success: false,
          newBalance: Number(user.balance),
          error: balanceResult.error
        };
      }

      // Update user balance in database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          balance: balanceResult.usdcBalance
        }
      });

      console.log(`✅ Updated balance for ${user.firstName} (${user.email}): ${Number(user.balance)} → ${balanceResult.usdcBalance} USDC`);

      return {
        success: true,
        newBalance: balanceResult.usdcBalance
      };

    } catch (error) {
      console.error(`❌ Error updating user balance from blockchain:`, error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update multiple users' balances from blockchain
   */
  public static async updateMultipleUserBalances(userIds: number[]): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      updated: 0,
      errors: [] as string[]
    };

    for (const userId of userIds) {
      try {
        const updateResult = await this.updateUserBalanceFromBlockchain(userId);
        
        if (updateResult.success) {
          result.updated++;
        } else {
          result.errors.push(`User ${userId}: ${updateResult.error}`);
        }
      } catch (error) {
        result.errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    console.log(`📊 Batch balance update complete: ${result.updated} users updated, ${result.errors.length} errors`);

    return result;
  }

  /**
   * Get balance sync statistics
   */
  public static async getBalanceSyncStats(): Promise<{
    totalUsers: number;
    usersWithWallets: number;
    lastSyncTime?: Date;
  }> {
    const totalUsers = await prisma.user.count();
    const usersWithWallets = await prisma.user.count({
      where: {
        solanaWallet: {
          not: null
        }
      }
    });

    // Get the most recent balance update (from updatedAt field)
    const mostRecentUser = await prisma.user.findFirst({
      where: {
        solanaWallet: {
          not: null
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        updatedAt: true
      }
    });

    return {
      totalUsers,
      usersWithWallets,
      lastSyncTime: mostRecentUser?.updatedAt
    };
  }

  /**
   * Validate wallet address format
   */
  public static isValidWalletAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

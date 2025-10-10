import { Connection, PublicKey, ParsedTransactionWithMeta, ParsedInstruction } from '@solana/web3.js';
import { PrismaClient } from '@prisma/client';
import { TreasuryDepositService } from './treasuryDepositService';
import { ExternalDepositService } from './externalDepositService';

const prisma = new PrismaClient();

export interface BlockchainDeposit {
  walletAddress: string;
  amount: number;
  currency: string;
  transactionHash: string;
  blockTime: number;
  depositType: 'AIRDROP' | 'EXTERNAL_FUNDING';
  fromAddress?: string;
  signature: string;
}

export interface DepositDetectionResult {
  newDeposits: BlockchainDeposit[];
  processedCount: number;
  errorCount: number;
  errors: string[];
}

export class BlockchainMonitorService {
  private static connection: Connection;
  private static readonly USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint address
  private static readonly LAMPORTS_PER_SOL = 1_000_000_000;

  /**
   * Initialize the service with Solana connection
   */
  public static initialize(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Monitor all user wallets for new deposits
   */
  public static async monitorUserWallets(): Promise<DepositDetectionResult> {
    if (!this.connection) {
      throw new Error('Connection not initialized. Call initialize() first.');
    }

    console.log('🔍 Starting blockchain monitoring for user wallets...');

    // Get all users with wallet addresses
    const users = await prisma.user.findMany({
      where: {
        solanaWallet: {
          not: null
        }
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        solanaWallet: true
      }
    });

    console.log(`📊 Monitoring ${users.length} user wallets`);

    const result: DepositDetectionResult = {
      newDeposits: [],
      processedCount: 0,
      errorCount: 0,
      errors: []
    };

    // Process each user's wallet
    for (const user of users) {
      if (!user.solanaWallet) continue;

      try {
        console.log(`🔍 Checking wallet: ${user.solanaWallet.substring(0, 8)}... (User: ${user.firstName})`);
        
        const deposits = await this.detectDepositsForWallet(user.solanaWallet, user.id);
        result.newDeposits.push(...deposits);
        result.processedCount++;

        if (deposits.length > 0) {
          console.log(`💰 Found ${deposits.length} new deposits for ${user.firstName}`);
        }

      } catch (error) {
        console.error(`❌ Error monitoring wallet ${user.solanaWallet}:`, error);
        result.errorCount++;
        result.errors.push(`Wallet ${user.solanaWallet}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ Monitoring complete: ${result.newDeposits.length} new deposits found, ${result.errorCount} errors`);
    return result;
  }

  /**
   * Detect deposits for a specific wallet address
   */
  public static async detectDepositsForWallet(
    walletAddress: string,
    userId: number
  ): Promise<BlockchainDeposit[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const walletPublicKey = new PublicKey(walletAddress);
    const deposits: BlockchainDeposit[] = [];

    try {
      // Get recent transactions for the wallet (last 24 hours)
      const signatures = await this.connection.getSignaturesForAddress(
        walletPublicKey,
        {
          limit: 100,
          before: undefined // Get most recent
        }
      );

      console.log(`📋 Found ${signatures.length} recent transactions for ${walletAddress.substring(0, 8)}...`);

      // Process each transaction
      for (const signatureInfo of signatures) {
        try {
          // Skip if transaction is too old (more than 24 hours)
          const now = Date.now() / 1000;
          if (signatureInfo.blockTime && (now - signatureInfo.blockTime) > 86400) {
            continue;
          }

          const transaction = await this.connection.getParsedTransaction(
            signatureInfo.signature,
            {
              maxSupportedTransactionVersion: 0
            }
          );

          if (!transaction) continue;

          const detectedDeposits = await this.analyzeTransactionForDeposits(
            transaction,
            walletAddress,
            userId,
            signatureInfo.signature,
            signatureInfo.blockTime || 0
          );

          deposits.push(...detectedDeposits);

        } catch (txError) {
          console.error(`❌ Error processing transaction ${signatureInfo.signature}:`, txError);
        }
      }

    } catch (error) {
      console.error(`❌ Error getting signatures for wallet ${walletAddress}:`, error);
      throw error;
    }

    return deposits;
  }

  /**
   * Analyze a transaction for deposits
   */
  private static async analyzeTransactionForDeposits(
    transaction: ParsedTransactionWithMeta,
    walletAddress: string,
    userId: number,
    signature: string,
    blockTime: number
  ): Promise<BlockchainDeposit[]> {
    const deposits: BlockchainDeposit[] = [];

    if (!transaction.meta || transaction.meta.err) {
      return deposits; // Skip failed transactions
    }

    // Check if this transaction has already been processed
    const existingDeposit = await prisma.deposit.findFirst({
      where: {
        transactionHash: signature
      }
    });

    if (existingDeposit) {
      return deposits; // Skip already processed transactions
    }

    // Analyze transfer instructions
    const instructions = transaction.transaction.message.instructions;
    
    for (const instruction of instructions) {
      if ('parsed' in instruction) {
        const parsedInstruction = instruction as ParsedInstruction;
        
        // Check for SOL transfers (airdrops)
        if (parsedInstruction.program === 'system' && parsedInstruction.parsed.type === 'transfer') {
          const transferInfo = parsedInstruction.parsed.info;
          
          // Check if this is a deposit TO our wallet
          if (transferInfo.destination === walletAddress) {
            const amount = parseFloat(transferInfo.lamports) / this.LAMPORTS_PER_SOL;
            
            // Determine if this is an airdrop or external funding
            const depositType = this.determineDepositType(transferInfo.source, amount);
            
            deposits.push({
              walletAddress,
              amount,
              currency: 'SOL', // SOL transfers
              transactionHash: signature,
              blockTime,
              depositType,
              fromAddress: transferInfo.source,
              signature
            });
          }
        }
        
        // Check for SPL token transfers (USDC, etc.)
        if (parsedInstruction.program === 'spl-token' && parsedInstruction.parsed.type === 'transfer') {
          const transferInfo = parsedInstruction.parsed.info;
          
          // Check if this is a deposit TO our wallet
          if (transferInfo.destination === walletAddress) {
            const amount = parseFloat(transferInfo.amount);
            const mint = transferInfo.mint;
            
            // Only process USDC transfers for now
            if (mint === this.USDC_MINT) {
              const depositType = this.determineDepositType(transferInfo.source, amount);
              
              deposits.push({
                walletAddress,
                amount: amount / 1_000_000, // USDC has 6 decimals
                currency: 'USDC',
                transactionHash: signature,
                blockTime,
                depositType,
                fromAddress: transferInfo.source,
                signature
              });
            }
          }
        }
      }
    }

    return deposits;
  }

  /**
   * Determine if a deposit is an airdrop or external funding
   */
  private static determineDepositType(fromAddress: string, amount: number): 'AIRDROP' | 'EXTERNAL_FUNDING' {
    // Known airdrop addresses (you can expand this list)
    const airdropAddresses = [
      '11111111111111111111111111111112', // System Program
      'So11111111111111111111111111111111111111112', // Wrapped SOL
    ];

    // Known faucet addresses
    const faucetAddresses = [
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM', // Example faucet
      // Add more known faucet addresses
    ];

    // Check if it's from a known airdrop/faucet address
    if (airdropAddresses.includes(fromAddress) || faucetAddresses.includes(fromAddress)) {
      return 'AIRDROP';
    }

    // Check amount thresholds (airdrops are typically small amounts)
    if (amount <= 2.0) { // Less than 2 SOL/USDC is likely an airdrop
      return 'AIRDROP';
    }

    // Everything else is external funding
    return 'EXTERNAL_FUNDING';
  }

  /**
   * Process detected deposits and create database records
   */
  public static async processDetectedDeposits(deposits: BlockchainDeposit[]): Promise<{
    processed: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      errors: [] as string[]
    };

    for (const deposit of deposits) {
      try {
        // Find the user for this wallet
        const user = await prisma.user.findFirst({
          where: {
            solanaWallet: deposit.walletAddress
          }
        });

        if (!user) {
          console.warn(`⚠️ No user found for wallet ${deposit.walletAddress}`);
          continue;
        }

        if (deposit.depositType === 'AIRDROP') {
          // Process as treasury deposit (system airdrop)
          await TreasuryDepositService.processAirdropDeposit(
            deposit.amount,
            deposit.transactionHash,
            `Blockchain detected airdrop to ${user.firstName} (${user.email})`
          );
        } else {
          // Process as external deposit
          await ExternalDepositService.processExternalDeposit({
            userId: user.id,
            fromExternalWallet: deposit.fromAddress || 'Unknown',
            amount: deposit.amount,
            currency: deposit.currency,
            transactionHash: deposit.transactionHash,
            notes: `Blockchain detected external funding to ${user.firstName} (${user.email})`
          });
        }

        result.processed++;
        console.log(`✅ Processed ${deposit.depositType} deposit: ${deposit.amount} ${deposit.currency} for ${user.firstName}`);

      } catch (error) {
        const errorMsg = `Error processing deposit ${deposit.transactionHash}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    return result;
  }

  /**
   * Get monitoring statistics
   */
  public static async getMonitoringStats(): Promise<{
    totalUsers: number;
    usersWithWallets: number;
    recentDeposits: number;
    lastMonitoringRun?: Date;
  }> {
    const totalUsers = await prisma.user.count();
    const usersWithWallets = await prisma.user.count({
      where: {
        solanaWallet: {
          not: null
        }
      }
    });

    // Get deposits from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDeposits = await prisma.deposit.count({
      where: {
        createdAt: {
          gte: oneDayAgo
        }
      }
    });

    return {
      totalUsers,
      usersWithWallets,
      recentDeposits
    };
  }
}




import { PrismaClient } from '@prisma/client';
import { MultisigVaultService } from './multisigVaultService';

const prisma = new PrismaClient();

export interface TreasuryDepositRequest {
  fromWallet: string;
  amount: number;
  currency?: string;
  transactionHash: string;
  depositType: 'MULTISIG_FUNDING' | 'TREASURY_FUNDING' | 'AIRDROP' | 'EXTERNAL_FUNDING';
  notes?: string;
  memberPublicKey?: string; // For multisig member funding
}

export interface TreasuryDepositResult {
  depositId: number;
  vaultAddress: string;
  newBalance: number;
  transactionHash: string;
  message: string;
}

export class TreasuryDepositService {
  /**
   * Process treasury deposit (multisig funding, airdrops, etc.)
   */
  public static async processTreasuryDeposit(
    request: TreasuryDepositRequest
  ): Promise<TreasuryDepositResult> {
    const {
      fromWallet,
      amount,
      currency = 'USDC',
      transactionHash,
      depositType,
      notes,
      memberPublicKey
    } = request;

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      throw new Error('Only USDC deposits are supported');
    }

    // Get or create vault using multisig vault service
    const multisigVault = MultisigVaultService.getInstance();
    const vault = await multisigVault.getOrCreateMultisigVault(currency);

    // Find or create vault record in database
    let vaultRecord = await prisma.vault.findUnique({
      where: { address: vault.multisigPda }
    });

    if (!vaultRecord) {
      vaultRecord = await prisma.vault.create({
        data: {
          address: vault.multisigPda,
          name: vault.name,
          totalBalance: 0,
          feeBalance: 0,
          currency: vault.currency,
          isActive: true
        }
      });
    }

    // Create deposit record
    const deposit = await prisma.deposit.create({
      data: {
        userId: 0, // System user ID for treasury deposits
        vaultId: vaultRecord.id,
        amount: parseFloat(amount.toString()),
        currency,
        status: 'COMPLETED',
        transactionHash,
        notes: notes || this.generateDepositNotes(depositType, fromWallet, memberPublicKey)
      }
    });

    // Update vault balance using multisig vault service
    await multisigVault.updateVaultBalance(
      vault.multisigPda,
      parseFloat(amount.toString()),
      'deposit'
    );

    console.log(`💰 Treasury deposit processed:`);
    console.log(`   Type: ${depositType}`);
    console.log(`   From: ${fromWallet}`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   Transaction: ${transactionHash}`);
    console.log(`   Deposit ID: ${deposit.id}`);

    return {
      depositId: deposit.id,
      vaultAddress: vault.multisigPda,
      newBalance: Number(vaultRecord.totalBalance) + parseFloat(amount.toString()),
      transactionHash,
      message: 'Treasury deposit processed successfully'
    };
  }

  /**
   * Process multisig member funding deposit
   */
  public static async processMultisigMemberFunding(
    memberPublicKey: string,
    amount: number,
    transactionHash: string,
    notes?: string
  ): Promise<TreasuryDepositResult> {
    return this.processTreasuryDeposit({
      fromWallet: memberPublicKey,
      amount,
      currency: 'USDC',
      transactionHash,
      depositType: 'MULTISIG_FUNDING',
      notes: notes || `Multisig member funding from ${memberPublicKey.substring(0, 8)}...`,
      memberPublicKey
    });
  }

  /**
   * Process airdrop deposit
   */
  public static async processAirdropDeposit(
    amount: number,
    transactionHash: string,
    notes?: string
  ): Promise<TreasuryDepositResult> {
    return this.processTreasuryDeposit({
      fromWallet: 'SOLANA_AIRDROP',
      amount,
      currency: 'USDC',
      transactionHash,
      depositType: 'AIRDROP',
      notes: notes || `SOL airdrop: ${amount} USDC`
    });
  }

  /**
   * Process external funding deposit
   */
  public static async processExternalFundingDeposit(
    fromWallet: string,
    amount: number,
    transactionHash: string,
    notes?: string
  ): Promise<TreasuryDepositResult> {
    return this.processTreasuryDeposit({
      fromWallet,
      amount,
      currency: 'USDC',
      transactionHash,
      depositType: 'EXTERNAL_FUNDING',
      notes: notes || `External funding from ${fromWallet.substring(0, 8)}...`
    });
  }

  /**
   * Get treasury deposits by type
   */
  public static async getTreasuryDepositsByType(
    depositType: string,
    limit: number = 50
  ): Promise<any[]> {
    const deposits = await prisma.deposit.findMany({
      where: {
        userId: 0, // System user ID
        notes: {
          contains: this.getDepositTypeKeyword(depositType)
        }
      },
      include: {
        vault: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return deposits;
  }

  /**
   * Get all treasury deposits
   */
  public static async getAllTreasuryDeposits(limit: number = 100): Promise<any[]> {
    const deposits = await prisma.deposit.findMany({
      where: {
        userId: 0 // System user ID
      },
      include: {
        vault: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return deposits;
  }

  /**
   * Get treasury deposit statistics
   */
  public static async getTreasuryDepositStats(): Promise<{
    totalDeposits: number;
    totalAmount: number;
    byType: Record<string, { count: number; amount: number }>;
    currency: string;
  }> {
    const stats = await prisma.deposit.aggregate({
      where: {
        userId: 0 // System user ID
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    // Get deposits by type
    const deposits = await prisma.deposit.findMany({
      where: {
        userId: 0
      },
      select: {
        amount: true,
        notes: true
      }
    });

    const byType: Record<string, { count: number; amount: number }> = {};
    
    deposits.forEach(deposit => {
      const type = this.extractDepositType(deposit.notes || '');
      if (!byType[type]) {
        byType[type] = { count: 0, amount: 0 };
      }
      byType[type].count++;
      byType[type].amount += Number(deposit.amount);
    });

    return {
      totalDeposits: stats._count.id || 0,
      totalAmount: Number(stats._sum.amount) || 0,
      byType,
      currency: 'USDC'
    };
  }

  /**
   * Generate deposit notes based on type
   */
  private static generateDepositNotes(
    depositType: string,
    fromWallet: string,
    memberPublicKey?: string
  ): string {
    switch (depositType) {
      case 'MULTISIG_FUNDING':
        return `Multisig member funding from ${memberPublicKey?.substring(0, 8) || fromWallet.substring(0, 8)}...`;
      case 'TREASURY_FUNDING':
        return `Treasury funding from ${fromWallet.substring(0, 8)}...`;
      case 'AIRDROP':
        return `SOL airdrop: ${fromWallet}`;
      case 'EXTERNAL_FUNDING':
        return `External funding from ${fromWallet.substring(0, 8)}...`;
      default:
        return `Treasury deposit from ${fromWallet.substring(0, 8)}...`;
    }
  }

  /**
   * Get deposit type keyword for filtering
   */
  private static getDepositTypeKeyword(depositType: string): string {
    switch (depositType) {
      case 'MULTISIG_FUNDING':
        return 'Multisig member funding';
      case 'TREASURY_FUNDING':
        return 'Treasury funding';
      case 'AIRDROP':
        return 'SOL airdrop';
      case 'EXTERNAL_FUNDING':
        return 'External funding';
      default:
        return 'Treasury deposit';
    }
  }

  /**
   * Extract deposit type from notes
   */
  private static extractDepositType(notes: string): string {
    if (notes.includes('Multisig member funding')) return 'MULTISIG_FUNDING';
    if (notes.includes('Treasury funding')) return 'TREASURY_FUNDING';
    if (notes.includes('SOL airdrop')) return 'AIRDROP';
    if (notes.includes('External funding')) return 'EXTERNAL_FUNDING';
    if (notes.includes('Fee collection')) return 'FEE_COLLECTION';
    if (notes.includes('Yield investment')) return 'YIELD_INVESTMENT';
    return 'OTHER';
  }
}


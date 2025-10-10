import { PrismaClient } from '@prisma/client';
import { MultisigVaultService } from './multisigVaultService';

const prisma = new PrismaClient();

export interface ExternalDepositRequest {
  userId: number;
  fromExternalWallet: string;
  amount: number;
  currency?: string;
  transactionHash: string;
  notes?: string;
}

export interface ExternalDepositResult {
  depositId: number;
  vaultAddress: string;
  newBalance: number;
  transactionHash: string;
  message: string;
}

export class ExternalDepositService {
  /**
   * Process external wallet deposit into the system
   */
  public static async processExternalDeposit(
    request: ExternalDepositRequest
  ): Promise<ExternalDepositResult> {
    const {
      userId,
      fromExternalWallet,
      amount,
      currency = 'USDC',
      transactionHash,
      notes
    } = request;

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      throw new Error('Only USDC deposits are supported');
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
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
        userId,
        vaultId: vaultRecord.id,
        amount: parseFloat(amount.toString()),
        currency,
        status: 'COMPLETED',
        transactionHash,
        notes: notes || `External deposit from ${fromExternalWallet.substring(0, 8)}...`
      }
    });

    // Update user balance
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: parseFloat(amount.toString())
        }
      }
    });

    // Update vault balance using multisig vault service
    await multisigVault.updateVaultBalance(
      vault.multisigPda,
      parseFloat(amount.toString()),
      'deposit'
    );

    console.log(`💰 External deposit processed:`);
    console.log(`   User: ${user.firstName} (${user.email})`);
    console.log(`   From: ${fromExternalWallet}`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   Transaction: ${transactionHash}`);
    console.log(`   New Balance: ${updatedUser.balance} ${currency}`);

    return {
      depositId: deposit.id,
      vaultAddress: vault.multisigPda,
      newBalance: Number(updatedUser.balance),
      transactionHash,
      message: 'External deposit processed successfully'
    };
  }

  /**
   * Get external deposits for a user
   */
  public static async getUserExternalDeposits(
    userId: number,
    limit: number = 50
  ): Promise<any[]> {
    const deposits = await prisma.deposit.findMany({
      where: {
        userId,
        notes: {
          contains: 'External deposit from'
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
   * Get all external deposits
   */
  public static async getAllExternalDeposits(limit: number = 100): Promise<any[]> {
    const deposits = await prisma.deposit.findMany({
      where: {
        notes: {
          contains: 'External deposit from'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            fullName: true,
            email: true
          }
        },
        vault: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return deposits;
  }

  /**
   * Get external deposit statistics
   */
  public static async getExternalDepositStats(): Promise<{
    totalDeposits: number;
    totalAmount: number;
    totalUsers: number;
    currency: string;
  }> {
    const stats = await prisma.deposit.aggregate({
      where: {
        notes: {
          contains: 'External deposit from'
        }
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    const uniqueUsers = await prisma.deposit.findMany({
      where: {
        notes: {
          contains: 'External deposit from'
        }
      },
      select: {
        userId: true
      },
      distinct: ['userId']
    });

    return {
      totalDeposits: stats._count.id || 0,
      totalAmount: Number(stats._sum.amount) || 0,
      totalUsers: uniqueUsers.length,
      currency: 'USDC'
    };
  }
}


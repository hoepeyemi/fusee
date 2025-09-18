import { prisma } from '../lib/prisma';
import FeeWalletService from './feeWalletService';

export class ExternalTransferService {
  private static readonly FEE_RATE = 0.00001; // 0.001% = 0.00001

  /**
   * Calculate the fee for a given transfer amount
   */
  public static calculateFee(amount: number): { fee: number; netAmount: number } {
    const fee = amount * this.FEE_RATE;
    const netAmount = amount - fee;
    
    return {
      fee: Math.max(fee, 0), // Ensure fee is not negative
      netAmount: Math.max(netAmount, 0) // Ensure net amount is not negative
    };
  }

  /**
   * Process external wallet transfer with fee collection
   */
  public static async processExternalTransfer(
    userId: number,
    fromWallet: string,
    toExternalWallet: string,
    amount: number,
    currency: string = 'SOL',
    notes?: string
  ): Promise<{
    transferId: number;
    fee: number;
    netAmount: number;
    feeWalletAddress: string;
    transactionHash: string;
  }> {
    // Verify user exists and has sufficient balance
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { fee, netAmount } = this.calculateFee(amount);

    // Check if user has sufficient balance
    if (Number(user.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    // Get the fee wallet service
    const feeWallet = FeeWalletService.getInstance();
    const feeWalletAddress = feeWallet.getFeeWalletAddress();

    // Create external transfer record
    const externalTransfer = await prisma.externalTransfer.create({
      data: {
        userId,
        fromWallet,
        toExternalWallet,
        amount,
        fee,
        netAmount,
        currency,
        feeWalletAddress,
        notes,
        status: 'PENDING'
      }
    });

    // Create external fee record
    const externalFee = await prisma.externalFee.create({
      data: {
        externalTransferId: externalTransfer.id,
        amount: fee,
        currency,
        feeRate: this.FEE_RATE,
        feeWalletAddress,
        status: 'COLLECTED'
      }
    });

    // Simulate blockchain transaction
    const transactionHash = `EXTERNAL_TRANSFER_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;

    // Update transfer with transaction hash and mark as completed
    const completedTransfer = await prisma.externalTransfer.update({
      where: { id: externalTransfer.id },
      data: {
        transactionHash,
        status: 'COMPLETED'
      }
    });

    // Update user balance (deduct full amount including fee)
    await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          decrement: amount
        }
      }
    });

    console.log(`💰 External transfer completed: ${amount} ${currency} from ${fromWallet} to external wallet ${toExternalWallet}`);
    console.log(`💰 Fee collected: ${fee} ${currency} (${this.FEE_RATE * 100}%)`);
    console.log(`💰 Fee sent to: ${feeWalletAddress}`);

    return {
      transferId: completedTransfer.id,
      fee,
      netAmount,
      feeWalletAddress,
      transactionHash
    };
  }

  /**
   * Get external transfer by ID
   */
  public static async getExternalTransfer(transferId: number) {
    return await prisma.externalTransfer.findUnique({
      where: { id: transferId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            email: true
          }
        },
        fees: true
      }
    });
  }

  /**
   * Get external transfers by user ID
   */
  public static async getExternalTransfersByUser(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    return await prisma.externalTransfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        fees: true
      }
    });
  }

  /**
   * Get external transfers by external wallet address
   */
  public static async getExternalTransfersByExternalWallet(
    externalWallet: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return await prisma.externalTransfer.findMany({
      where: { toExternalWallet: externalWallet },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            email: true
          }
        },
        fees: true
      }
    });
  }

  /**
   * Get external transfer statistics
   */
  public static async getExternalTransferStatistics() {
    const [totalTransfers, totalVolume, totalFees, recentTransfers] = await Promise.all([
      prisma.externalTransfer.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.externalTransfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.externalTransfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { fee: true }
      }),
      prisma.externalTransfer.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              firstName: true
            }
          },
          fees: true
        }
      })
    ]);

    return {
      totalTransfers,
      totalVolume: Number(totalVolume._sum.amount) || 0,
      totalFees: Number(totalFees._sum.fee) || 0,
      averageTransfer: totalTransfers > 0 ? (Number(totalVolume._sum.amount) || 0) / totalTransfers : 0,
      averageFee: totalTransfers > 0 ? (Number(totalFees._sum.fee) || 0) / totalTransfers : 0,
      recentTransfers
    };
  }

  /**
   * Validate external wallet address
   */
  public static validateExternalWalletAddress(externalWallet: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic validation
    if (!externalWallet || externalWallet.length < 32) {
      errors.push('Invalid external wallet address');
    }

    // Check if address is valid base58 (basic check)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (externalWallet && !base58Regex.test(externalWallet)) {
      errors.push('External wallet address contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if external wallet is in database (internal wallet)
   */
  public static async isInternalWallet(walletAddress: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { solanaWallet: walletAddress }
    });
    
    return !!user;
  }
}

export default ExternalTransferService;

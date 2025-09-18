import { prisma } from '../lib/prisma';
import FeeWalletService from './feeWalletService';

export class WalletTransferService {
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
   * Process wallet-to-wallet transfer with fee collection
   */
  public static async processWalletTransfer(
    fromWallet: string,
    toWallet: string,
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
    const { fee, netAmount } = this.calculateFee(amount);

    // Get the fee wallet service
    const feeWallet = FeeWalletService.getInstance();
    const feeWalletAddress = feeWallet.getFeeWalletAddress();

    // Create wallet transfer record
    const walletTransfer = await prisma.walletTransfer.create({
      data: {
        fromWallet,
        toWallet,
        amount,
        fee,
        netAmount,
        currency,
        feeWalletAddress,
        notes,
        status: 'PENDING'
      }
    });

    // Create wallet fee record
    const walletFee = await prisma.walletFee.create({
      data: {
        walletTransferId: walletTransfer.id,
        amount: fee,
        currency,
        feeRate: this.FEE_RATE,
        feeWalletAddress,
        status: 'COLLECTED'
      }
    });

    // Simulate blockchain transaction
    const transactionHash = `WALLET_TRANSFER_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;

    // Update transfer with transaction hash and mark as completed
    const completedTransfer = await prisma.walletTransfer.update({
      where: { id: walletTransfer.id },
      data: {
        transactionHash,
        status: 'COMPLETED'
      }
    });

    console.log(`💰 Wallet transfer completed: ${amount} ${currency} from ${fromWallet} to ${toWallet}`);
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
   * Get wallet transfer by ID
   */
  public static async getWalletTransfer(transferId: number) {
    return await prisma.walletTransfer.findUnique({
      where: { id: transferId },
      include: {
        fees: true
      }
    });
  }

  /**
   * Get wallet transfers by wallet address
   */
  public static async getWalletTransfersByAddress(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return await prisma.walletTransfer.findMany({
      where: {
        OR: [
          { fromWallet: walletAddress },
          { toWallet: walletAddress }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        fees: true
      }
    });
  }

  /**
   * Get wallet transfer statistics
   */
  public static async getWalletTransferStatistics() {
    const [totalTransfers, totalVolume, totalFees, recentTransfers] = await Promise.all([
      prisma.walletTransfer.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.walletTransfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.walletTransfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { fee: true }
      }),
      prisma.walletTransfer.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
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
   * Validate wallet addresses
   */
  public static validateWalletAddresses(fromWallet: string, toWallet: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic validation
    if (!fromWallet || fromWallet.length < 32) {
      errors.push('Invalid source wallet address');
    }

    if (!toWallet || toWallet.length < 32) {
      errors.push('Invalid destination wallet address');
    }

    if (fromWallet === toWallet) {
      errors.push('Source and destination wallets cannot be the same');
    }

    // Check if addresses are valid base58 (basic check)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (fromWallet && !base58Regex.test(fromWallet)) {
      errors.push('Source wallet address contains invalid characters');
    }

    if (toWallet && !base58Regex.test(toWallet)) {
      errors.push('Destination wallet address contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default WalletTransferService;

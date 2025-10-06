import { prisma } from '../lib/prisma';
import DedicatedWalletService from './dedicatedWallet';
import FeeWalletService from './feeWalletService';
import UnifiedVaultService from './unifiedVaultService';

export class FeeService {
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
   * Process fee collection for a transfer
   */
  public static async processTransferFee(
    transferId: number,
    amount: number,
    currency: string = 'USDC'
  ): Promise<{ fee: number; netAmount: number; feeWalletAddress: string }> {
    const { fee, netAmount } = this.calculateFee(amount);

    // Get the dedicated fee wallet service
    const feeWallet = FeeWalletService.getInstance();
    const feeWalletAddress = feeWallet.getFeeWalletAddress();
    const feeWalletName = feeWallet.getFeeWalletName();

    // Get the main vault for record keeping (with fallback mechanism)
    const unifiedVault = UnifiedVaultService.getInstance();
    const vaultInfo = await unifiedVault.getVault(currency);
    
    // Get the actual vault record from database
    const vault = await prisma.vault.findUnique({
      where: { address: vaultInfo.address }
    });
    
    if (!vault) {
      throw new Error(`Vault not found: ${vaultInfo.address}`);
    }

    // Create fee record with fee wallet information
    const feeRecord = await prisma.fee.create({
      data: {
        transferId,
        vaultId: vault.id, // Still linked to main vault for record keeping
        amount: fee,
        currency,
        feeRate: this.FEE_RATE,
        status: 'COLLECTED'
      }
    });

    // Update vault fee balance for tracking (but actual fees go to fee wallet)
    await prisma.vault.update({
      where: { id: vault.id },
      data: {
        feeBalance: {
          increment: fee
        }
      }
    });

    console.log(`💰 Fee collected: ${fee} ${currency} (${this.FEE_RATE * 100}% of ${amount})`);
    console.log(`💰 Fee sent to dedicated wallet: ${feeWalletAddress} (${feeWalletName})`);
    console.log(`🏦 Vault type: ${vaultInfo.vaultType} (${vaultInfo.isSecure ? 'Secure' : 'Fallback'})`);

    return { fee, netAmount, feeWalletAddress };
  }

  /**
   * Get total fees collected
   */
  public static async getTotalFees(currency?: string): Promise<number> {
    const whereClause = currency ? { currency } : {};
    
    const result = await prisma.fee.aggregate({
      where: {
        ...whereClause,
        status: 'COLLECTED'
      },
      _sum: {
        amount: true
      }
    });

    return Number(result._sum.amount) || 0;
  }

  /**
   * Get fee statistics
   */
  public static async getFeeStatistics(currency?: string) {
    const whereClause = currency ? { currency } : {};

    const [totalFees, feeCount, recentFees] = await Promise.all([
      this.getTotalFees(currency),
      prisma.fee.count({
        where: {
          ...whereClause,
          status: 'COLLECTED'
        }
      }),
      prisma.fee.findMany({
        where: {
          ...whereClause,
          status: 'COLLECTED'
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          transfer: {
            select: {
              id: true,
              amount: true,
              sender: {
                select: {
                  fullName: true,
                  firstName: true
                }
              },
              receiver: {
                select: {
                  fullName: true,
                  firstName: true
                }
              }
            }
          }
        }
      })
    ]);

    return {
      totalFees,
      feeCount,
      averageFee: feeCount > 0 ? totalFees / feeCount : 0,
      recentFees
    };
  }

  /**
   * Get vault fee balance
   */
  public static async getVaultFeeBalance(currency: string = 'SOL'): Promise<number> {
    const unifiedVault = UnifiedVaultService.getInstance();
    const vaultInfo = await unifiedVault.getVault(currency);
    
    return vaultInfo.feeBalance;
  }

  /**
   * Get fee wallet information
   */
  public static getFeeWalletInfo(): { address: string; name: string } {
    const feeWallet = FeeWalletService.getInstance();
    return feeWallet.getFeeWalletInfo();
  }

  /**
   * Get fee wallet status
   */
  public static getFeeWalletStatus(): {
    isConfigured: boolean;
    address: string | null;
    name: string | null;
    error?: string;
  } {
    const feeWallet = FeeWalletService.getInstance();
    return feeWallet.getFeeWalletStatus();
  }
}

export default FeeService;

import { prisma } from '../lib/prisma';
import { MultisigService } from './multisigService';

export interface MultisigVaultInfo {
  multisigPda: string;
  name: string;
  totalBalance: number;
  feeBalance: number;
  currency: string;
  isActive: boolean;
  memberCount: number;
  threshold: number;
  timeLock: number;
}

export class MultisigVaultService {
  private static instance: MultisigVaultService;
  private multisigPda: string | null = null;

  private constructor() {}

  static getInstance(): MultisigVaultService {
    if (!MultisigVaultService.instance) {
      MultisigVaultService.instance = new MultisigVaultService();
    }
    return MultisigVaultService.instance;
  }

  /**
   * Get or create multisig vault
   */
  async getOrCreateMultisigVault(currency: string = 'USDC'): Promise<MultisigVaultInfo> {
    try {
      // Try to get existing multisig PDA
      let multisigPda = await MultisigService.getMainMultisigPda();
      
      if (!multisigPda) {
        throw new Error('No main multisig found. Please create a multisig first.');
      }

      this.multisigPda = multisigPda;

      // Check if vault exists for this multisig
      let vault = await prisma.vault.findUnique({
        where: { address: multisigPda }
      });

      if (!vault) {
        // Create vault for multisig PDA
        vault = await prisma.vault.create({
          data: {
            address: multisigPda,
            name: 'Multisig Main Vault',
            totalBalance: 0,
            feeBalance: 0,
            currency,
            isActive: true
          }
        });
        console.log(`🏦 Created vault for multisig PDA: ${multisigPda}`);
      }

      // Get multisig info
      const multisig = await prisma.multisig.findUnique({
        where: { multisigPda },
        include: {
          members: {
            where: { isActive: true }
          }
        }
      });

      if (!multisig) {
        throw new Error('Multisig not found in database');
      }

      return {
        multisigPda: vault.address,
        name: vault.name,
        totalBalance: Number(vault.totalBalance),
        feeBalance: Number(vault.feeBalance),
        currency: vault.currency,
        isActive: vault.isActive,
        memberCount: multisig.members.length,
        threshold: multisig.threshold,
        timeLock: multisig.timeLock
      };

    } catch (error) {
      console.error('Error getting or creating multisig vault:', error);
      throw error;
    }
  }

  /**
   * Get multisig vault status
   */
  async getMultisigVaultStatus(): Promise<{
    vaults: MultisigVaultInfo[];
    totalBalance: number;
    totalFeeBalance: number;
  }> {
    try {
      const multisigPda = await MultisigService.getMainMultisigPda();
      
      if (!multisigPda) {
        return {
          vaults: [],
          totalBalance: 0,
          totalFeeBalance: 0
        };
      }

      const vault = await prisma.vault.findUnique({
        where: { address: multisigPda },
        include: {
          // We'll get multisig info separately
        }
      });

      if (!vault) {
        return {
          vaults: [],
          totalBalance: 0,
          totalFeeBalance: 0
        };
      }

      // Get multisig info
      const multisig = await prisma.multisig.findUnique({
        where: { multisigPda },
        include: {
          members: {
            where: { isActive: true }
          }
        }
      });

      const vaultInfo: MultisigVaultInfo = {
        multisigPda: vault.address,
        name: vault.name,
        totalBalance: Number(vault.totalBalance),
        feeBalance: Number(vault.feeBalance),
        currency: vault.currency,
        isActive: vault.isActive,
        memberCount: multisig?.members.length || 0,
        threshold: multisig?.threshold || 0,
        timeLock: multisig?.timeLock || 0
      };

      return {
        vaults: [vaultInfo],
        totalBalance: vaultInfo.totalBalance,
        totalFeeBalance: vaultInfo.feeBalance
      };

    } catch (error) {
      console.error('Error getting multisig vault status:', error);
      throw error;
    }
  }

  /**
   * Update vault balance
   */
  async updateVaultBalance(
    multisigPda: string,
    amount: number,
    operation: 'deposit' | 'withdrawal' | 'fee'
  ): Promise<void> {
    try {
      const vault = await prisma.vault.findUnique({
        where: { address: multisigPda }
      });

      if (!vault) {
        throw new Error('Vault not found');
      }

      const updateData: any = {};

      if (operation === 'deposit') {
        updateData.totalBalance = { increment: amount };
      } else if (operation === 'withdrawal') {
        updateData.totalBalance = { decrement: amount };
      } else if (operation === 'fee') {
        updateData.feeBalance = { increment: amount };
        updateData.totalBalance = { increment: amount };
      }

      await prisma.vault.update({
        where: { address: multisigPda },
        data: updateData
      });

      console.log(`💰 Updated vault balance: ${operation} ${amount} ${vault.currency}`);

    } catch (error) {
      console.error('Error updating vault balance:', error);
      throw error;
    }
  }

  /**
   * Get multisig wallet address
   */
  getMultisigWalletAddress(): string | null {
    return this.multisigPda;
  }

  /**
   * Get multisig wallet name
   */
  getMultisigWalletName(): string {
    return 'Multisig Main Vault';
  }
}

import { prisma } from '../lib/prisma';
import { MultisigVaultService } from './multisigVaultService';
import DedicatedWalletService from './dedicatedWallet';

export interface UnifiedVaultInfo {
  vaultType: 'multisig' | 'dedicated';
  address: string;
  name: string;
  totalBalance: number;
  feeBalance: number;
  currency: string;
  isActive: boolean;
  isSecure: boolean; // true for multisig, false for dedicated wallet
}

export class UnifiedVaultService {
  private static instance: UnifiedVaultService;

  private constructor() {}

  static getInstance(): UnifiedVaultService {
    if (!UnifiedVaultService.instance) {
      UnifiedVaultService.instance = new UnifiedVaultService();
    }
    return UnifiedVaultService.instance;
  }

  /**
   * Get vault with automatic fallback mechanism
   */
  async getVault(currency: string = 'SOL'): Promise<UnifiedVaultInfo> {
    // Priority 1: Try multisig vault (most secure)
    try {
      const multisigVault = MultisigVaultService.getInstance();
      const vault = await multisigVault.getOrCreateMultisigVault(currency);
      
      return {
        vaultType: 'multisig',
        address: vault.multisigPda,
        name: vault.name,
        totalBalance: vault.totalBalance,
        feeBalance: vault.feeBalance,
        currency: vault.currency,
        isActive: vault.isActive,
        isSecure: true
      };
    } catch (error) {
      console.warn('⚠️ Multisig vault not available, trying dedicated wallet fallback:', error.message);
    }

    // Priority 2: Try dedicated wallet (fallback)
    try {
      const dedicatedWallet = DedicatedWalletService.getInstance();
      const vault = await dedicatedWallet.getOrCreateVault(currency);
      
      if (vault.address && vault.address.length > 0) {
        return {
          vaultType: 'dedicated',
          address: vault.address,
          name: vault.name,
          totalBalance: Number(vault.totalBalance),
          feeBalance: Number(vault.feeBalance),
          currency: vault.currency,
          isActive: vault.isActive,
          isSecure: false
        };
      }
    } catch (error) {
      console.warn('⚠️ Dedicated wallet not configured:', error.message);
    }

    // No fallback available
    throw new Error('No vault configuration available. Please configure either multisig or dedicated wallet.');
  }


  /**
   * Get vault status with fallback information
   */
  async getVaultStatus(): Promise<{
    currentVault: UnifiedVaultInfo;
    availableOptions: string[];
    recommendations: string[];
  }> {
    const currentVault = await this.getVault();
    const availableOptions: string[] = [];
    const recommendations: string[] = [];

    // Check what's available
    try {
      const multisigVault = MultisigVaultService.getInstance();
      await multisigVault.getOrCreateMultisigVault('SOL');
      availableOptions.push('multisig');
      if (currentVault.vaultType !== 'multisig') {
        recommendations.push('Upgrade to multisig vault for enhanced security');
      }
    } catch (error) {
      // Multisig not available
    }

    try {
      const dedicatedWallet = DedicatedWalletService.getInstance();
      const address = dedicatedWallet.getWalletAddress();
      if (address && address.length > 0) {
        availableOptions.push('dedicated');
      }
    } catch (error) {
      // Dedicated wallet not configured
    }

    if (currentVault.vaultType === 'dedicated') {
      recommendations.push('Consider upgrading to multisig vault for enhanced security');
    }

    return {
      currentVault,
      availableOptions,
      recommendations
    };
  }

  /**
   * Update vault balance (works with any vault type)
   */
  async updateVaultBalance(address: string, amount: number, currency: string = 'SOL') {
    const vault = await prisma.vault.findUnique({
      where: { address }
    });

    if (!vault) {
      throw new Error(`Vault not found: ${address}`);
    }

    const updatedVault = await prisma.vault.update({
      where: { address },
      data: {
        totalBalance: {
          increment: amount
        }
      }
    });

    console.log(`💰 Updated vault balance: ${address} +${amount} ${currency}`);
    return updatedVault;
  }
}

export default UnifiedVaultService;

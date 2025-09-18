import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';

// Load environment variables from project roo
dotenv.config({ path: '.env' });

export class DedicatedWalletService {
  private static instance: DedicatedWalletService;

  private constructor() {
    // Wallet address is read-only from environment variables
  }

  public static getInstance(): DedicatedWalletService {
    if (!DedicatedWalletService.instance) {
      DedicatedWalletService.instance = new DedicatedWalletService();
    }
    return DedicatedWalletService.instance;
  }

  public getWalletAddress(): string {
    return process.env.DEDICATED_WALLET_ADDRESS || '';
  }

  public getWalletName(): string {
    return process.env.DEDICATED_WALLET_NAME || 'Fusee Main Vault';
  }

  public async getOrCreateVault(currency: string = 'SOL') {
    const currentAddress = this.getWalletAddress();
    const currentName = this.getWalletName();
    
    // Try to find existing vault with current address
    let vault = await prisma.vault.findFirst({
      where: { 
        address: currentAddress,
        currency,
        isActive: true 
      }
    });

    if (!vault) {
      // Create new vault with current dedicated wallet address
      vault = await prisma.vault.create({
        data: {
          address: currentAddress,
          name: `${currentName} (${currency})`,
          currency,
          totalBalance: 0,
          isActive: true
        }
      });
    }

    return vault;
  }

  public async getVaultStatus() {
    const vaults = await prisma.vault.findMany({
      where: { isActive: true },
      orderBy: { currency: 'asc' }
    });

    return {
      dedicatedWalletAddress: this.getWalletAddress(),
      dedicatedWalletName: this.getWalletName(),
      vaults
    };
  }

  public async getTotalVaultBalance() {
    const result = await prisma.vault.aggregate({
      where: { isActive: true },
      _sum: {
        totalBalance: true
      }
    });

    return result._sum.totalBalance || 0;
  }
}

export default DedicatedWalletService;

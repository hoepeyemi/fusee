import dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config({ path: '.env' });

export class FeeWalletService {
  private static instance: FeeWalletService;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): FeeWalletService {
    if (!FeeWalletService.instance) {
      FeeWalletService.instance = new FeeWalletService();
    }
    return FeeWalletService.instance;
  }

  /**
   * Get the dedicated fee wallet address from environment variables
   */
  public getFeeWalletAddress(): string {
    const address = process.env.FEE_WALLET_ADDRESS;
    if (!address) {
      throw new Error('FEE_WALLET_ADDRESS environment variable is not set');
    }
    return address;
  }

  /**
   * Get the dedicated fee wallet name from environment variables
   */
  public getFeeWalletName(): string {
    const name = process.env.FEE_WALLET_NAME;
    if (!name) {
      throw new Error('FEE_WALLET_NAME environment variable is not set');
    }
    return name;
  }

  /**
   * Get fee wallet information
   */
  public getFeeWalletInfo(): { address: string; name: string } {
    return {
      address: this.getFeeWalletAddress(),
      name: this.getFeeWalletName()
    };
  }

  /**
   * Validate fee wallet configuration
   */
  public validateFeeWalletConfig(): boolean {
    try {
      const address = this.getFeeWalletAddress();
      const name = this.getFeeWalletName();
      
      // Basic validation
      if (!address || address.length < 32) {
        return false;
      }
      
      if (!name || name.length < 1) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get fee wallet status and configuration
   */
  public getFeeWalletStatus(): {
    isConfigured: boolean;
    address: string | null;
    name: string | null;
    error?: string;
  } {
    try {
      const address = this.getFeeWalletAddress();
      const name = this.getFeeWalletName();
      
      return {
        isConfigured: true,
        address,
        name
      };
    } catch (error) {
      return {
        isConfigured: false,
        address: null,
        name: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default FeeWalletService;

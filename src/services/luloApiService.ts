import { Connection, VersionedTransaction, TransactionMessage, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export interface LuloApiConfig {
  apiKey: string;
  baseUrl: string;
  priorityFee?: string;
}

export interface LuloTransactionResponse {
  transaction: string;
}

export interface LuloInstructionsResponse {
  instructions: {
    computeBudgetInstructions: any[];
    [key: string]: any;
    addressLookupTableAddresses: string[];
    setupInstructions: any[];
  };
}

export interface LuloAccountData {
  owner: string;
  luloAccount: string;
  luloAccountExists: boolean;
  referrerAccount?: string;
  referrerAccountExists?: boolean;
  referredAmount?: number;
  protectedReferredAmount?: number;
  regularReferredAmount?: number;
  referralFeeUnclaimed?: number;
  netReferralFeesUnclaimed?: number;
  referralFee?: number;
  claimFee?: number;
  numReferrals?: number;
  code?: string;
}

export interface LuloPoolData {
  regular: {
    type: string;
    apy: number;
    maxWithdrawalAmount: number;
    price: number;
  };
  protected: {
    type: string;
    apy: number;
    openCapacity: number;
    price: number;
  };
  averagePoolRate: number;
  totalLiquidity: number;
  availableLiquidity: number;
  regularLiquidityAmount: number;
  protectedLiquidityAmount: number;
  regularAvailableAmount: number;
}

export interface LuloRates {
  regular: {
    CURRENT: number;
    '1HR': number;
    '1YR': number;
    '24HR': number;
    '30DAY': number;
    '7DAY': number;
  };
  protected: {
    CURRENT: number;
    '1HR': number;
    '1YR': number;
    '24HR': number;
    '30DAY': number;
    '7DAY': number;
  };
}

export interface LuloPendingWithdrawal {
  owner: string;
  withdrawalId: number;
  nativeAmount: string;
  createdTimestamp: number;
  cooldownSeconds: string;
  mintAddress: string;
}

export interface LuloPendingWithdrawalsResponse {
  pendingWithdrawals: LuloPendingWithdrawal[];
}

export class LuloApiService {
  private static instance: LuloApiService;
  private config: LuloApiConfig;

  private constructor() {
    this.config = {
      apiKey: process.env.LULO_API_KEY || '',
      baseUrl: 'https://api.lulo.fi/v1',
      priorityFee: process.env.LULO_PRIORITY_FEE || '50000'
    };

    if (!this.config.apiKey) {
      throw new Error('LULO_API_KEY environment variable is required');
    }
  }

  public static getInstance(): LuloApiService {
    if (!LuloApiService.instance) {
      LuloApiService.instance = new LuloApiService();
    }
    return LuloApiService.instance;
  }

  /**
   * Make authenticated request to Lulo API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    try {
      const url = new URL(`${this.config.baseUrl}${endpoint}`);
      
      // Add query parameters
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const requestOptions: RequestInit = {
        method,
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json'
        }
      };

      if (data && method === 'POST') {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url.toString(), requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Lulo API error: ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Lulo API request failed:', error);
      if (error instanceof Error) {
        throw new Error(`Lulo API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Initialize referrer account
   */
  public async initializeReferrer(
    owner: string,
    feePayer: string,
    useInstructions: boolean = false
  ): Promise<LuloTransactionResponse | LuloInstructionsResponse> {
    const endpoint = useInstructions 
      ? '/generate.instructions.initializeReferrer'
      : '/generate.transaction.initializeReferrer';

    const data = {
      owner,
      feePayer
    };

    const queryParams = {
      priorityFee: this.config.priorityFee!
    };

    return this.makeRequest<LuloTransactionResponse | LuloInstructionsResponse>(
      endpoint,
      'POST',
      data,
      queryParams
    );
  }

  /**
   * Generate deposit transaction/instructions
   */
  public async generateDeposit(
    owner: string,
    feePayer: string,
    mintAddress: string,
    regularAmount?: number,
    protectedAmount?: number,
    referrer?: string,
    useInstructions: boolean = false
  ): Promise<LuloTransactionResponse | LuloInstructionsResponse> {
    const endpoint = useInstructions 
      ? '/generate.instructions.deposit'
      : '/generate.transactions.deposit';

    const data: any = {
      owner,
      feePayer,
      mintAddress
    };

    if (regularAmount !== undefined) {
      data.regularAmount = regularAmount;
    }
    if (protectedAmount !== undefined) {
      data.protectedAmount = protectedAmount;
    }
    if (referrer) {
      data.referrer = referrer;
    }

    const queryParams = {
      priorityFee: this.config.priorityFee!
    };

    return this.makeRequest<LuloTransactionResponse | LuloInstructionsResponse>(
      endpoint,
      'POST',
      data,
      queryParams
    );
  }

  /**
   * Generate withdraw protected transaction/instructions
   */
  public async generateWithdrawProtected(
    owner: string,
    feePayer: string,
    mintAddress: string,
    amount: number,
    useInstructions: boolean = false
  ): Promise<LuloTransactionResponse | LuloInstructionsResponse> {
    const endpoint = useInstructions 
      ? '/generate.instructions.withdrawProtected'
      : '/generate.transactions.withdrawProtected';

    const data = {
      owner,
      feePayer,
      mintAddress,
      amount
    };

    const queryParams = {
      priorityFee: this.config.priorityFee!
    };

    return this.makeRequest<LuloTransactionResponse | LuloInstructionsResponse>(
      endpoint,
      'POST',
      data,
      queryParams
    );
  }

  /**
   * Generate initiate regular withdrawal transaction/instructions
   */
  public async generateInitiateRegularWithdraw(
    owner: string,
    feePayer: string,
    mintAddress: string,
    amount: number,
    useInstructions: boolean = false
  ): Promise<LuloTransactionResponse | LuloInstructionsResponse> {
    const endpoint = useInstructions 
      ? '/generate.instructions.initiateRegularWithdraw'
      : '/generate.transactions.initiateRegularWithdraw';

    const data = {
      owner,
      feePayer,
      mintAddress,
      amount
    };

    const queryParams = {
      priorityFee: this.config.priorityFee!
    };

    return this.makeRequest<LuloTransactionResponse | LuloInstructionsResponse>(
      endpoint,
      'POST',
      data,
      queryParams
    );
  }

  /**
   * Generate complete regular withdrawal transaction/instructions
   */
  public async generateCompleteRegularWithdrawal(
    owner: string,
    feePayer: string,
    pendingWithdrawalId: number,
    useInstructions: boolean = false
  ): Promise<LuloTransactionResponse | LuloInstructionsResponse> {
    const endpoint = useInstructions 
      ? '/generate.instructions.completeRegularWithdrawal'
      : '/generate.transactions.completeRegularWithdrawal';

    const data = {
      owner,
      feePayer,
      pendingWithdrawalId
    };

    const queryParams = {
      priorityFee: this.config.priorityFee!
    };

    return this.makeRequest<LuloTransactionResponse | LuloInstructionsResponse>(
      endpoint,
      'POST',
      data,
      queryParams
    );
  }

  /**
   * Get account data
   */
  public async getAccount(owner: string): Promise<LuloAccountData> {
    const queryParams = { owner };
    return this.makeRequest<LuloAccountData>('/account.getAccount', 'GET', undefined, queryParams);
  }

  /**
   * Get pool data
   */
  public async getPools(owner?: string): Promise<LuloPoolData> {
    const queryParams = owner ? { owner } : undefined;
    return this.makeRequest<LuloPoolData>('/pool.getPools', 'GET', undefined, queryParams);
  }

  /**
   * Get current rates
   */
  public async getRates(owner?: string): Promise<LuloRates> {
    const queryParams = owner ? { owner } : undefined;
    return this.makeRequest<LuloRates>('/rates.getRates', 'GET', undefined, queryParams);
  }

  /**
   * Get pending withdrawals
   */
  public async getPendingWithdrawals(owner: string): Promise<LuloPendingWithdrawalsResponse> {
    const queryParams = { owner };
    return this.makeRequest<LuloPendingWithdrawalsResponse>('/account.withdrawals.listPendingWithdrawals', 'GET', undefined, queryParams);
  }

  /**
   * Get referrer data
   */
  public async getReferrer(owner: string): Promise<LuloAccountData> {
    const queryParams = { owner };
    return this.makeRequest<LuloAccountData>('/referral.getReferrer', 'GET', undefined, queryParams);
  }

  /**
   * Deserialize transaction from base58 string
   */
  public deserializeTransaction(serializedTx: string): VersionedTransaction {
    try {
      const transactionBytes = bs58.decode(serializedTx);
      return VersionedTransaction.deserialize(transactionBytes);
    } catch (error) {
      throw new Error(`Failed to deserialize transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Serialize transaction to base58 string
   */
  public serializeTransaction(transaction: VersionedTransaction): string {
    try {
      return bs58.encode(transaction.serialize());
    } catch (error) {
      throw new Error(`Failed to serialize transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Lulo API configuration
   */
  public validateConfig(): boolean {
    try {
      return !!(this.config.apiKey && this.config.baseUrl);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get configuration status
   */
  public getConfigStatus(): {
    isConfigured: boolean;
    hasApiKey: boolean;
    baseUrl: string;
    error?: string;
  } {
    try {
      return {
        isConfigured: this.validateConfig(),
        hasApiKey: !!this.config.apiKey,
        baseUrl: this.config.baseUrl,
      };
    } catch (error) {
      return {
        isConfigured: false,
        hasApiKey: false,
        baseUrl: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default LuloApiService;

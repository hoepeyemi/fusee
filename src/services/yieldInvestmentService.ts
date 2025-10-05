import { prisma } from '../lib/prisma';
import { MultisigProposalService } from './multisigProposalService';

export interface LuloApiResponse {
  transaction?: string;
  instructions?: any;
  error?: string;
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

export interface PendingWithdrawal {
  owner: string;
  withdrawalId: number;
  nativeAmount: string;
  createdTimestamp: number;
  cooldownSeconds: string;
  mintAddress: string;
}

export interface YieldInvestmentRequest {
  userId: number;
  owner: string;
  feePayer: string;
  mintAddress?: string;
  regularAmount?: number;
  protectedAmount?: number;
  referrer?: string;
  priorityFee?: string;
}

export interface YieldWithdrawalRequest {
  userId: number;
  owner: string;
  feePayer: string;
  mintAddress?: string;
  amount: number;
  priorityFee?: string;
}

export interface YieldInvestmentResult {
  investmentId: number;
  transactionHash: string;
  amount: number;
  type: 'protected' | 'regular' | 'both';
  status: string;
  luloAccount?: string;
  referrerAccount?: string;
}

export class YieldInvestmentService {
  private static readonly LULO_API_BASE_URL = 'https://api.lulo.fi/v1';
  private static readonly USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  private static readonly DEFAULT_PRIORITY_FEE = '50000';

  /**
   * Get Lulo API key from environment
   */
  private static getApiKey(): string {
    const apiKey = process.env.LULO_API_KEY;
    if (!apiKey) {
      throw new Error('LULO_API_KEY environment variable is required');
    }
    return apiKey;
  }

  /**
   * Make API request to Lulo
   */
  private static async makeLuloApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<any> {
    const url = new URL(`${this.LULO_API_BASE_URL}${endpoint}`);
    
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const options: RequestInit = {
      method,
      headers: {
        'x-api-key': this.getApiKey(),
        'Content-Type': 'application/json',
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url.toString(), options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lulo API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Lulo API request failed:', error);
      throw new Error(`Failed to communicate with Lulo API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize referrer account for a user
   */
  public static async initializeReferrer(
    userId: number,
    owner: string,
    feePayer: string,
    priorityFee: string = this.DEFAULT_PRIORITY_FEE
  ): Promise<{
    transaction: string;
    referrerAccount?: string;
  }> {
    try {
      // Validate inputs
      if (!owner || !feePayer) {
        throw new Error('Owner and fee payer addresses are required');
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate referrer initialization transaction
      const response = await this.makeLuloApiRequest(
        '/generate.transaction.initializeReferrer',
        'POST',
        {
          owner,
          feePayer,
        },
        { priorityFee }
      );

      if (!response.transaction) {
        throw new Error('Failed to generate referrer initialization transaction');
      }

      // Store referrer initialization record
      const referrerRecord = await prisma.yieldInvestment.create({
        data: {
          userId,
          owner,
          type: 'REFERRER_INIT',
          amount: 0,
          status: 'PENDING',
          transactionHash: 'pending',
          luloAccount: owner,
          notes: 'Referrer account initialization'
        }
      });

      return {
        transaction: response.transaction,
        referrerAccount: response.referrerAccount
      };

    } catch (error) {
      console.error('Error initializing referrer:', error);
      throw new Error(`Failed to initialize referrer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create yield investment (deposit)
   */
  public static async createYieldInvestment(
    request: YieldInvestmentRequest
  ): Promise<YieldInvestmentResult> {
    try {
      // Validate inputs
      if (!request.owner || !request.feePayer) {
        throw new Error('Owner and fee payer addresses are required');
      }

      if (!request.regularAmount && !request.protectedAmount) {
        throw new Error('Either regular amount or protected amount must be specified');
      }

      if (request.regularAmount && request.regularAmount <= 0) {
        throw new Error('Regular amount must be greater than 0');
      }

      if (request.protectedAmount && request.protectedAmount <= 0) {
        throw new Error('Protected amount must be greater than 0');
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: request.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate deposit transaction
      const response = await this.makeLuloApiRequest(
        '/generate.transactions.deposit',
        'POST',
        {
          owner: request.owner,
          feePayer: request.feePayer,
          mintAddress: request.mintAddress || this.USDC_MINT_ADDRESS,
          regularAmount: request.regularAmount || 0,
          protectedAmount: request.protectedAmount || 0,
          referrer: request.referrer
        },
        { priorityFee: request.priorityFee || this.DEFAULT_PRIORITY_FEE }
      );

      if (!response.transaction) {
        throw new Error('Failed to generate deposit transaction');
      }

      // Determine investment type
      let investmentType: 'protected' | 'regular' | 'both' = 'protected';
      if (request.regularAmount && request.protectedAmount) {
        investmentType = 'both';
      } else if (request.regularAmount) {
        investmentType = 'regular';
      }

      // Calculate total amount
      const totalAmount = (request.regularAmount || 0) + (request.protectedAmount || 0);

      // Create multisig proposal for the investment
      const proposalService = MultisigProposalService.getInstance();
      const proposal = await proposalService.createYieldInvestmentProposal({
        userId: request.userId,
        owner: request.owner,
        amount: totalAmount,
        type: investmentType,
        regularAmount: request.regularAmount,
        protectedAmount: request.protectedAmount,
        referrer: request.referrer,
        transaction: response.transaction
      });

      // Store yield investment record
      const investment = await prisma.yieldInvestment.create({
        data: {
          userId: request.userId,
          owner: request.owner,
          type: investmentType.toUpperCase(),
          amount: totalAmount,
          regularAmount: request.regularAmount || 0,
          protectedAmount: request.protectedAmount || 0,
          status: 'PENDING_APPROVAL',
          transactionHash: 'pending',
          luloAccount: request.owner,
          referrerAccount: request.referrer,
          proposalId: proposal.proposalId,
          notes: `Yield investment: ${investmentType} - ${totalAmount} USDC`
        }
      });

      return {
        investmentId: investment.id,
        transactionHash: response.transaction,
        amount: totalAmount,
        type: investmentType,
        status: 'PENDING_APPROVAL',
        luloAccount: request.owner,
        referrerAccount: request.referrer
      };

    } catch (error) {
      console.error('Error creating yield investment:', error);
      throw new Error(`Failed to create yield investment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw protected amount
   */
  public static async withdrawProtected(
    request: YieldWithdrawalRequest
  ): Promise<{
    investmentId: number;
    transactionHash: string;
    amount: number;
    status: string;
  }> {
    try {
      // Validate inputs
      if (!request.owner || !request.feePayer) {
        throw new Error('Owner and fee payer addresses are required');
      }

      if (!request.amount || request.amount <= 0) {
        throw new Error('Withdrawal amount must be greater than 0');
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: request.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate protected withdrawal transaction
      const response = await this.makeLuloApiRequest(
        '/generate.transactions.withdrawProtected',
        'POST',
        {
          owner: request.owner,
          feePayer: request.feePayer,
          mintAddress: request.mintAddress || this.USDC_MINT_ADDRESS,
          amount: request.amount
        },
        { priorityFee: request.priorityFee || this.DEFAULT_PRIORITY_FEE }
      );

      if (!response.transaction) {
        throw new Error('Failed to generate protected withdrawal transaction');
      }

      // Create multisig proposal for the withdrawal
      const proposalService = MultisigProposalService.getInstance();
      const proposal = await proposalService.createYieldWithdrawalProposal({
        userId: request.userId,
        owner: request.owner,
        amount: request.amount,
        type: 'protected',
        transaction: response.transaction
      });

      // Store yield withdrawal record
      const withdrawal = await prisma.yieldInvestment.create({
        data: {
          userId: request.userId,
          owner: request.owner,
          type: 'PROTECTED_WITHDRAWAL',
          amount: request.amount,
          status: 'PENDING_APPROVAL',
          transactionHash: 'pending',
          luloAccount: request.owner,
          proposalId: proposal.proposalId,
          notes: `Protected withdrawal: ${request.amount} USDC`
        }
      });

      return {
        investmentId: withdrawal.id,
        transactionHash: response.transaction,
        amount: request.amount,
        status: 'PENDING_APPROVAL'
      };

    } catch (error) {
      console.error('Error withdrawing protected amount:', error);
      throw new Error(`Failed to withdraw protected amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initiate regular withdrawal
   */
  public static async initiateRegularWithdrawal(
    request: YieldWithdrawalRequest
  ): Promise<{
    investmentId: number;
    transactionHash: string;
    amount: number;
    status: string;
  }> {
    try {
      // Validate inputs
      if (!request.owner || !request.feePayer) {
        throw new Error('Owner and fee payer addresses are required');
      }

      if (!request.amount || request.amount <= 0) {
        throw new Error('Withdrawal amount must be greater than 0');
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: request.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate regular withdrawal initiation transaction
      const response = await this.makeLuloApiRequest(
        '/generate.transactions.initiateRegularWithdraw',
        'POST',
        {
          owner: request.owner,
          feePayer: request.feePayer,
          mintAddress: request.mintAddress || this.USDC_MINT_ADDRESS,
          amount: request.amount
        },
        { priorityFee: request.priorityFee || this.DEFAULT_PRIORITY_FEE }
      );

      if (!response.transaction) {
        throw new Error('Failed to generate regular withdrawal initiation transaction');
      }

      // Create multisig proposal for the withdrawal
      const proposalService = MultisigProposalService.getInstance();
      const proposal = await proposalService.createYieldWithdrawalProposal({
        userId: request.userId,
        owner: request.owner,
        amount: request.amount,
        type: 'regular',
        transaction: response.transaction
      });

      // Store yield withdrawal record
      const withdrawal = await prisma.yieldInvestment.create({
        data: {
          userId: request.userId,
          owner: request.owner,
          type: 'REGULAR_WITHDRAWAL_INIT',
          amount: request.amount,
          status: 'PENDING_APPROVAL',
          transactionHash: 'pending',
          luloAccount: request.owner,
          proposalId: proposal.proposalId,
          notes: `Regular withdrawal initiation: ${request.amount} USDC`
        }
      });

      return {
        investmentId: withdrawal.id,
        transactionHash: response.transaction,
        amount: request.amount,
        status: 'PENDING_APPROVAL'
      };

    } catch (error) {
      console.error('Error initiating regular withdrawal:', error);
      throw new Error(`Failed to initiate regular withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete regular withdrawal
   */
  public static async completeRegularWithdrawal(
    userId: number,
    owner: string,
    feePayer: string,
    pendingWithdrawalId: number,
    priorityFee: string = this.DEFAULT_PRIORITY_FEE
  ): Promise<{
    investmentId: number;
    transactionHash: string;
    status: string;
  }> {
    try {
      // Validate inputs
      if (!owner || !feePayer) {
        throw new Error('Owner and fee payer addresses are required');
      }

      if (!pendingWithdrawalId || pendingWithdrawalId <= 0) {
        throw new Error('Valid pending withdrawal ID is required');
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate regular withdrawal completion transaction
      const response = await this.makeLuloApiRequest(
        '/generate.transactions.completeRegularWithdrawal',
        'POST',
        {
          owner,
          feePayer,
          pendingWithdrawalId
        },
        { priorityFee }
      );

      if (!response.transaction) {
        throw new Error('Failed to generate regular withdrawal completion transaction');
      }

      // Create multisig proposal for the withdrawal completion
      const proposalService = MultisigProposalService.getInstance();
      const proposal = await proposalService.createYieldWithdrawalProposal({
        userId,
        owner,
        amount: 0, // Amount is not needed for completion
        type: 'regular_completion',
        transaction: response.transaction
      });

      // Store yield withdrawal completion record
      const withdrawal = await prisma.yieldInvestment.create({
        data: {
          userId,
          owner,
          type: 'REGULAR_WITHDRAWAL_COMPLETE',
          amount: 0,
          status: 'PENDING_APPROVAL',
          transactionHash: 'pending',
          luloAccount: owner,
          proposalId: proposal.proposalId,
          notes: `Regular withdrawal completion: ID ${pendingWithdrawalId}`
        }
      });

      return {
        investmentId: withdrawal.id,
        transactionHash: response.transaction,
        status: 'PENDING_APPROVAL'
      };

    } catch (error) {
      console.error('Error completing regular withdrawal:', error);
      throw new Error(`Failed to complete regular withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account data from Lulo
   */
  public static async getAccountData(owner: string): Promise<LuloAccountData> {
    try {
      if (!owner) {
        throw new Error('Owner address is required');
      }

      const response = await this.makeLuloApiRequest(
        '/account.getAccount',
        'GET',
        undefined,
        { owner }
      );

      return response;
    } catch (error) {
      console.error('Error getting account data:', error);
      throw new Error(`Failed to get account data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool information from Lulo
   */
  public static async getPoolData(owner?: string): Promise<LuloPoolData> {
    try {
      const queryParams = owner ? { owner } : undefined;
      const response = await this.makeLuloApiRequest(
        '/pool.getPools',
        'GET',
        undefined,
        queryParams
      );

      return response;
    } catch (error) {
      console.error('Error getting pool data:', error);
      throw new Error(`Failed to get pool data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current rates from Lulo
   */
  public static async getRates(owner?: string): Promise<LuloRates> {
    try {
      const queryParams = owner ? { owner } : undefined;
      const response = await this.makeLuloApiRequest(
        '/rates.getRates',
        'GET',
        undefined,
        queryParams
      );

      return response;
    } catch (error) {
      console.error('Error getting rates:', error);
      throw new Error(`Failed to get rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending withdrawals from Lulo
   */
  public static async getPendingWithdrawals(owner: string): Promise<PendingWithdrawal[]> {
    try {
      if (!owner) {
        throw new Error('Owner address is required');
      }

      const response = await this.makeLuloApiRequest(
        '/account.withdrawals.listPendingWithdrawals',
        'GET',
        undefined,
        { owner }
      );

      return response.pendingWithdrawals || [];
    } catch (error) {
      console.error('Error getting pending withdrawals:', error);
      throw new Error(`Failed to get pending withdrawals: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get referrer data from Lulo
   */
  public static async getReferrerData(owner: string): Promise<LuloAccountData> {
    try {
      if (!owner) {
        throw new Error('Owner address is required');
      }

      const response = await this.makeLuloApiRequest(
        '/referral.getReferrer',
        'GET',
        undefined,
        { owner }
      );

      return response;
    } catch (error) {
      console.error('Error getting referrer data:', error);
      throw new Error(`Failed to get referrer data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's yield investments from database
   */
  public static async getUserYieldInvestments(userId: number): Promise<any[]> {
    try {
      const investments = await prisma.yieldInvestment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              email: true,
              solanaWallet: true
            }
          }
        }
      });

      return investments;
    } catch (error) {
      console.error('Error getting user yield investments:', error);
      throw new Error(`Failed to get user yield investments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update investment status
   */
  public static async updateInvestmentStatus(
    investmentId: number,
    status: 'PENDING' | 'PENDING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    transactionHash?: string
  ): Promise<void> {
    try {
      await prisma.yieldInvestment.update({
        where: { id: investmentId },
        data: {
          status: status as any, // Type assertion to handle Prisma enum
          transactionHash: transactionHash || undefined,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating investment status:', error);
      throw new Error(`Failed to update investment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}


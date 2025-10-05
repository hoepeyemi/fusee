import { prisma } from '../lib/prisma';
import { LuloApiService, LuloAccountData, LuloPoolData, LuloRates, LuloPendingWithdrawalsResponse } from './luloApiService';
import { MultisigProposalService } from './multisigProposalService';
import { OnDemandMultisigService } from './onDemandMultisigService';

export interface BoostedYieldInvestment {
  id: number;
  userId: number;
  owner: string;
  type: 'PROTECTED' | 'REGULAR' | 'BOTH' | 'PROTECTED_WITHDRAWAL' | 'REGULAR_WITHDRAWAL_INIT' | 'REGULAR_WITHDRAWAL_COMPLETE' | 'REFERRER_INIT';
  amount: number;
  regularAmount?: number;
  protectedAmount?: number;
  status: 'PENDING' | 'PENDING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  transactionHash?: string;
  luloAccount?: string;
  referrerAccount?: string;
  proposalId?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoostedYieldInvestmentRequest {
  userId: number;
  owner: string;
  type: 'PROTECTED' | 'REGULAR' | 'BOTH' | 'PROTECTED_WITHDRAWAL' | 'REGULAR_WITHDRAWAL_INIT' | 'REGULAR_WITHDRAWAL_COMPLETE' | 'REFERRER_INIT';
  amount: number;
  regularAmount?: number;
  protectedAmount?: number;
  referrer?: string;
  notes?: string;
}

export interface BoostedYieldWithdrawalRequest {
  userId: number;
  owner: string;
  type: 'PROTECTED_WITHDRAWAL' | 'REGULAR_WITHDRAWAL_INIT' | 'REGULAR_WITHDRAWAL_COMPLETE';
  amount: number;
  pendingWithdrawalId?: number;
  notes?: string;
}

export class BoostedYieldService {
  private static instance: BoostedYieldService;
  private luloApi: LuloApiService;
  private multisigService: MultisigProposalService;

  private constructor() {
    this.luloApi = LuloApiService.getInstance();
    this.multisigService = MultisigProposalService.getInstance();
  }

  public static getInstance(): BoostedYieldService {
    if (!BoostedYieldService.instance) {
      BoostedYieldService.instance = new BoostedYieldService();
    }
    return BoostedYieldService.instance;
  }

  /**
   * Initialize referrer account for a user
   */
  public async initializeReferrer(
    userId: number,
    owner: string,
    feePayer: string,
    notes?: string
  ): Promise<{ investmentId: number; proposalId: number; multisigPda: string }> {
    try {
      // Ensure user has multisig
      await OnDemandMultisigService.ensureUserMultisig(userId);

      // Generate Lulo transaction
      const luloResponse = await this.luloApi.initializeReferrer(owner, feePayer, true);
      
      if (!('instructions' in luloResponse)) {
        throw new Error('Invalid response from Lulo API');
      }

      // Create investment record
      const investment = await prisma.yieldInvestment.create({
        data: {
          userId,
          owner,
          type: 'REFERRER_INIT',
          amount: 0, // No amount for referrer initialization
          status: 'PENDING',
          notes: notes || 'Initialize referrer account'
        }
      });

      // Create multisig proposal
      const proposalResult = await this.multisigService.createYieldInvestmentProposal({
        userId,
        owner,
        amount: 0,
        type: 'referrer_init',
        regularAmount: 0,
        protectedAmount: 0,
        referrer: undefined,
        transaction: luloResponse.instructions
      });

      // Update investment with proposal ID
      await prisma.yieldInvestment.update({
        where: { id: investment.id },
        data: { proposalId: proposalResult.proposalId }
      });

      return {
        investmentId: investment.id,
        proposalId: proposalResult.proposalId,
        multisigPda: proposalResult.multisigPda
      };
    } catch (error) {
      console.error('Error initializing referrer:', error);
      throw new Error(`Failed to initialize referrer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create boosted yield investment (deposit)
   */
  public async createInvestment(
    request: BoostedYieldInvestmentRequest
  ): Promise<{ investmentId: number; proposalId: number; multisigPda: string }> {
    try {
      const { userId, owner, type, amount, regularAmount, protectedAmount, referrer, notes } = request;

      // Ensure user has multisig
      await OnDemandMultisigService.ensureUserMultisig(userId);

      // Validate investment type
      if (!['PROTECTED', 'REGULAR', 'BOTH'].includes(type)) {
        throw new Error('Invalid investment type for deposit');
      }

      // Generate Lulo transaction
      const luloResponse = await this.luloApi.generateDeposit(
        owner,
        owner, // feePayer same as owner
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint address
        regularAmount,
        protectedAmount,
        referrer,
        true // use instructions
      );

      if (!('instructions' in luloResponse)) {
        throw new Error('Invalid response from Lulo API');
      }

      // Create investment record
      const investment = await prisma.yieldInvestment.create({
        data: {
          userId,
          owner,
          type,
          amount,
          regularAmount: regularAmount || undefined,
          protectedAmount: protectedAmount || undefined,
          status: 'PENDING',
          notes: notes || `Boosted yield investment: ${type} - ${amount} USDC`
        }
      });

      // Create multisig proposal
      const proposalResult = await this.multisigService.createYieldInvestmentProposal({
        userId,
        owner,
        amount,
        type: type.toLowerCase() as any,
        regularAmount,
        protectedAmount,
        referrer,
        transaction: luloResponse.instructions
      });

      // Update investment with proposal ID
      await prisma.yieldInvestment.update({
        where: { id: investment.id },
        data: { proposalId: proposalResult.proposalId }
      });

      return {
        investmentId: investment.id,
        proposalId: proposalResult.proposalId,
        multisigPda: proposalResult.multisigPda
      };
    } catch (error) {
      console.error('Error creating boosted yield investment:', error);
      throw new Error(`Failed to create investment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create boosted yield withdrawal
   */
  public async createWithdrawal(
    request: BoostedYieldWithdrawalRequest
  ): Promise<{ investmentId: number; proposalId: number; multisigPda: string }> {
    try {
      const { userId, owner, type, amount, pendingWithdrawalId, notes } = request;

      // Ensure user has multisig
      await OnDemandMultisigService.ensureUserMultisig(userId);

      let luloResponse;

      if (type === 'PROTECTED_WITHDRAWAL') {
        // Generate protected withdrawal transaction
        luloResponse = await this.luloApi.generateWithdrawProtected(
          owner,
          owner, // feePayer same as owner
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint address
          amount,
          true // use instructions
        );
      } else if (type === 'REGULAR_WITHDRAWAL_INIT') {
        // Generate initiate regular withdrawal transaction
        luloResponse = await this.luloApi.generateInitiateRegularWithdraw(
          owner,
          owner, // feePayer same as owner
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint address
          amount,
          true // use instructions
        );
      } else if (type === 'REGULAR_WITHDRAWAL_COMPLETE') {
        // Generate complete regular withdrawal transaction
        if (!pendingWithdrawalId) {
          throw new Error('pendingWithdrawalId is required for completing regular withdrawal');
        }
        luloResponse = await this.luloApi.generateCompleteRegularWithdrawal(
          owner,
          owner, // feePayer same as owner
          pendingWithdrawalId,
          true // use instructions
        );
      } else {
        throw new Error('Invalid withdrawal type');
      }

      if (!('instructions' in luloResponse)) {
        throw new Error('Invalid response from Lulo API');
      }

      // Create investment record
      const investment = await prisma.yieldInvestment.create({
        data: {
          userId,
          owner,
          type,
          amount,
          status: 'PENDING',
          notes: notes || `Boosted yield withdrawal: ${type} - ${amount} USDC`
        }
      });

      // Create multisig proposal
      const proposalResult = await this.multisigService.createYieldWithdrawalProposal({
        userId,
        owner,
        amount,
        type: type.toLowerCase() as any,
        pendingWithdrawalId,
        transaction: luloResponse.instructions
      });

      // Update investment with proposal ID
      await prisma.yieldInvestment.update({
        where: { id: investment.id },
        data: { proposalId: proposalResult.proposalId }
      });

      return {
        investmentId: investment.id,
        proposalId: proposalResult.proposalId,
        multisigPda: proposalResult.multisigPda
      };
    } catch (error) {
      console.error('Error creating boosted yield withdrawal:', error);
      throw new Error(`Failed to create withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account data from Lulo
   */
  public async getAccountData(owner: string): Promise<LuloAccountData> {
    try {
      return await this.luloApi.getAccount(owner);
    } catch (error) {
      console.error('Error fetching account data:', error);
      throw new Error(`Failed to fetch account data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool data from Lulo
   */
  public async getPoolData(owner?: string): Promise<LuloPoolData> {
    try {
      return await this.luloApi.getPools(owner);
    } catch (error) {
      console.error('Error fetching pool data:', error);
      throw new Error(`Failed to fetch pool data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current rates from Lulo
   */
  public async getRates(owner?: string): Promise<LuloRates> {
    try {
      return await this.luloApi.getRates(owner);
    } catch (error) {
      console.error('Error fetching rates:', error);
      throw new Error(`Failed to fetch rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending withdrawals from Lulo
   */
  public async getPendingWithdrawals(owner: string): Promise<LuloPendingWithdrawalsResponse> {
    try {
      return await this.luloApi.getPendingWithdrawals(owner);
    } catch (error) {
      console.error('Error fetching pending withdrawals:', error);
      throw new Error(`Failed to fetch pending withdrawals: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get referrer data from Lulo
   */
  public async getReferrerData(owner: string): Promise<LuloAccountData> {
    try {
      return await this.luloApi.getReferrer(owner);
    } catch (error) {
      console.error('Error fetching referrer data:', error);
      throw new Error(`Failed to fetch referrer data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's yield investments from database
   */
  public async getUserInvestments(userId: number): Promise<BoostedYieldInvestment[]> {
    try {
      const investments = await prisma.yieldInvestment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return investments.map(investment => ({
        id: investment.id,
        userId: investment.userId,
        owner: investment.owner,
        type: investment.type as any,
        amount: Number(investment.amount),
        regularAmount: investment.regularAmount ? Number(investment.regularAmount) : undefined,
        protectedAmount: investment.protectedAmount ? Number(investment.protectedAmount) : undefined,
        status: investment.status as any,
        transactionHash: investment.transactionHash || undefined,
        luloAccount: investment.luloAccount || undefined,
        referrerAccount: investment.referrerAccount || undefined,
        proposalId: investment.proposalId || undefined,
        notes: investment.notes || undefined,
        createdAt: investment.createdAt,
        updatedAt: investment.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching user investments:', error);
      throw new Error(`Failed to fetch user investments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update investment status
   */
  public async updateInvestmentStatus(
    investmentId: number,
    status: 'PENDING' | 'PENDING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    transactionHash?: string
  ): Promise<void> {
    try {
      await prisma.yieldInvestment.update({
        where: { id: investmentId },
        data: {
          status: status as any,
          transactionHash: transactionHash || undefined,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating investment status:', error);
      throw new Error(`Failed to update investment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get investment by ID
   */
  public async getInvestmentById(investmentId: number): Promise<BoostedYieldInvestment | null> {
    try {
      const investment = await prisma.yieldInvestment.findUnique({
        where: { id: investmentId }
      });

      if (!investment) {
        return null;
      }

      return {
        id: investment.id,
        userId: investment.userId,
        owner: investment.owner,
        type: investment.type as any,
        amount: Number(investment.amount),
        regularAmount: investment.regularAmount ? Number(investment.regularAmount) : undefined,
        protectedAmount: investment.protectedAmount ? Number(investment.protectedAmount) : undefined,
        status: investment.status as any,
        transactionHash: investment.transactionHash || undefined,
        luloAccount: investment.luloAccount || undefined,
        referrerAccount: investment.referrerAccount || undefined,
        proposalId: investment.proposalId || undefined,
        notes: investment.notes || undefined,
        createdAt: investment.createdAt,
        updatedAt: investment.updatedAt
      };
    } catch (error) {
      console.error('Error fetching investment by ID:', error);
      throw new Error(`Failed to fetch investment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Lulo API configuration
   */
  public validateLuloConfig(): boolean {
    return this.luloApi.validateConfig();
  }

  /**
   * Get Lulo API configuration status
   */
  public getLuloConfigStatus() {
    return this.luloApi.getConfigStatus();
  }
}

export default BoostedYieldService;

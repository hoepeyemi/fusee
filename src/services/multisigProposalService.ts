import { prisma } from '../lib/prisma';
import { MultisigService } from './multisigService';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface TransferProposalRequest {
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency: string;
  memo?: string;
  transferType: 'WALLET' | 'EXTERNAL';
  userId?: number;
}

export interface YieldInvestmentProposalRequest {
  userId: number;
  owner: string;
  amount: number;
  type: 'protected' | 'regular' | 'both' | 'referrer_init';
  regularAmount?: number;
  protectedAmount?: number;
  referrer?: string;
  transaction: any; // Lulo instructions object
}

export interface YieldWithdrawalProposalRequest {
  userId: number;
  owner: string;
  amount: number;
  type: 'protected' | 'regular' | 'regular_completion';
  pendingWithdrawalId?: number;
  transaction: any; // Lulo instructions object
}

export interface MultisigProposalResult {
  proposalId: number;
  multisigPda: string;
  transactionIndex: string;
  status: 'PENDING' | 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
  message: string;
}

export class MultisigProposalService {
  private static instance: MultisigProposalService;
  private connection: Connection;

  private constructor() {
    this.connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
  }

  static getInstance(): MultisigProposalService {
    if (!MultisigProposalService.instance) {
      MultisigProposalService.instance = new MultisigProposalService();
    }
    return MultisigProposalService.instance;
  }

  /**
   * Create a multisig transaction proposal for wallet transfer
   */
  async createWalletTransferProposal(request: TransferProposalRequest): Promise<MultisigProposalResult> {
    try {
      // Validate request
      if (!request.fromWallet || !request.toWallet) {
        throw new Error('Invalid wallet addresses');
      }

      if (!request.amount || request.amount <= 0) {
        throw new Error('Invalid amount');
      }

      if (!request.currency) {
        throw new Error('Currency is required');
      }

      // Validate currency - only USDC allowed for wallet transfers
      if (request.currency !== 'USDC') {
        throw new Error('Only USDC transfers are allowed between wallet addresses');
      }

      // Get main multisig PDA
      const multisigPda = await MultisigService.getMainMultisigPda();
      if (!multisigPda) {
        throw new Error('No main multisig found. Please create a multisig first.');
      }

      // Get multisig from database
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

      // Create transaction proposal
      const proposal = await prisma.multisigTransaction.create({
        data: {
          multisigId: multisig.id,
          transactionIndex: BigInt(Date.now()), // Use timestamp as transaction index
          fromWallet: request.fromWallet,
          toWallet: request.toWallet,
          amount: request.amount,
          currency: request.currency,
          status: 'PENDING',
          memo: request.memo || `Wallet transfer: ${request.amount} ${request.currency}`
        }
      });

      // Create proposal record
      const proposalRecord = await prisma.multisigProposal.create({
        data: {
          multisigTransactionId: proposal.id,
          proposerKey: request.fromWallet, // Using fromWallet as proposer for now
          status: 'PENDING'
        }
      });

      console.log(`📝 Created wallet transfer proposal:`);
      console.log(`   Proposal ID: ${proposal.id}`);
      console.log(`   Multisig PDA: ${multisigPda}`);
      console.log(`   From: ${request.fromWallet}`);
      console.log(`   To: ${request.toWallet}`);
      console.log(`   Amount: ${request.amount} ${request.currency}`);

      return {
        proposalId: proposal.id,
        multisigPda: multisigPda,
        transactionIndex: proposal.transactionIndex.toString(),
        status: 'PENDING',
        message: 'Wallet transfer proposal created successfully. Awaiting multisig approval.'
      };

    } catch (error) {
      console.error('Error creating wallet transfer proposal:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('multisig') || error.message.includes('Multisig')) {
          throw new Error('Multisig service error: ' + error.message);
        }
        
        if (error.message.includes('Prisma') || error.message.includes('database')) {
          throw new Error('Database error: ' + error.message);
        }
        
        if (error.message.includes('Invalid') || error.message.includes('required')) {
          throw new Error('Validation error: ' + error.message);
        }
        
        // Return the original error message for user-friendly errors
        throw new Error(error.message);
      }
      
      throw new Error('Failed to create wallet transfer proposal. Please try again.');
    }
  }

  /**
   * Create a multisig transaction proposal for external transfer
   */
  async createExternalTransferProposal(request: TransferProposalRequest): Promise<MultisigProposalResult> {
    try {
      // Validate request
      if (!request.fromWallet || !request.toWallet) {
        throw new Error('Invalid wallet addresses');
      }

      if (!request.amount || request.amount <= 0) {
        throw new Error('Invalid amount');
      }

      if (!request.currency) {
        throw new Error('Currency is required');
      }

      // Get main multisig PDA
      const multisigPda = await MultisigService.getMainMultisigPda();
      if (!multisigPda) {
        throw new Error('No main multisig found. Please create a multisig first.');
      }

      // Get multisig from database
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

      // Create transaction proposal
      const proposal = await prisma.multisigTransaction.create({
        data: {
          multisigId: multisig.id,
          transactionIndex: BigInt(Date.now()), // Use timestamp as transaction index
          fromWallet: request.fromWallet,
          toWallet: request.toWallet,
          amount: request.amount,
          currency: request.currency,
          status: 'PENDING',
          memo: request.memo || `External transfer: ${request.amount} ${request.currency}`
        }
      });

      // Create proposal record
      const proposalRecord = await prisma.multisigProposal.create({
        data: {
          multisigTransactionId: proposal.id,
          proposerKey: request.fromWallet, // Using fromWallet as proposer for now
          status: 'PENDING'
        }
      });

      console.log(`📝 Created external transfer proposal:`);
      console.log(`   Proposal ID: ${proposal.id}`);
      console.log(`   Multisig PDA: ${multisigPda}`);
      console.log(`   From: ${request.fromWallet}`);
      console.log(`   To: ${request.toWallet}`);
      console.log(`   Amount: ${request.amount} ${request.currency}`);

      return {
        proposalId: proposal.id,
        multisigPda: multisigPda,
        transactionIndex: proposal.transactionIndex.toString(),
        status: 'PENDING',
        message: 'External transfer proposal created successfully. Awaiting multisig approval.'
      };

    } catch (error) {
      console.error('Error creating external transfer proposal:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('multisig') || error.message.includes('Multisig')) {
          throw new Error('Multisig service error: ' + error.message);
        }
        
        if (error.message.includes('Prisma') || error.message.includes('database')) {
          throw new Error('Database error: ' + error.message);
        }
        
        if (error.message.includes('Invalid') || error.message.includes('required')) {
          throw new Error('Validation error: ' + error.message);
        }
        
        // Return the original error message for user-friendly errors
        throw new Error(error.message);
      }
      
      throw new Error('Failed to create external transfer proposal. Please try again.');
    }
  }

  /**
   * Get all pending proposals for a multisig
   */
  async getPendingProposals(multisigPda: string): Promise<any[]> {
    try {
      const multisig = await prisma.multisig.findUnique({
        where: { multisigPda }
      });

      if (!multisig) {
        throw new Error('Multisig not found');
      }

      const proposals = await prisma.multisigTransaction.findMany({
        where: {
          multisigId: multisig.id,
          status: 'PENDING'
        },
        include: {
          proposals: true,
          approvals: {
            include: {
              member: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return proposals;

    } catch (error) {
      console.error('Error getting pending proposals:', error);
      throw error;
    }
  }

  /**
   * Approve a proposal
   */
  async approveProposal(proposalId: number, memberPublicKey: string): Promise<boolean> {
    try {
      // Find the member
      const member = await prisma.multisigMember.findFirst({
        where: {
          publicKey: memberPublicKey,
          isActive: true
        }
      });

      if (!member) {
        throw new Error('Member not found or inactive');
      }

      // Check if already approved
      const existingApproval = await prisma.multisigApproval.findFirst({
        where: {
          multisigTransactionId: proposalId,
          memberId: member.id
        }
      });

      if (existingApproval) {
        throw new Error('Proposal already approved by this member');
      }

      // Create approval
      await prisma.multisigApproval.create({
        data: {
          multisigTransactionId: proposalId,
          memberId: member.id,
          approvalType: 'APPROVE'
        }
      });

      // Check if enough approvals
      const proposal = await prisma.multisigTransaction.findUnique({
        where: { id: proposalId },
        include: {
          multisig: true,
          approvals: true
        }
      });

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const approvalCount = proposal.approvals.length;
      const threshold = proposal.multisig.threshold;

      if (approvalCount >= threshold) {
        // Update proposal status to approved
        await prisma.multisigTransaction.update({
          where: { id: proposalId },
          data: { status: 'APPROVED' }
        });

        console.log(`✅ Proposal ${proposalId} approved by ${approvalCount}/${threshold} members`);
      } else {
        console.log(`📊 Proposal ${proposalId} has ${approvalCount}/${threshold} approvals`);
      }

      return true;

    } catch (error) {
      console.error('Error approving proposal:', error);
      throw error;
    }
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(proposalId: number, memberPublicKey: string): Promise<boolean> {
    try {
      // Find the member
      const member = await prisma.multisigMember.findFirst({
        where: {
          publicKey: memberPublicKey,
          isActive: true
        }
      });

      if (!member) {
        throw new Error('Member not found or inactive');
      }

      // Create rejection
      await prisma.multisigApproval.create({
        data: {
          multisigTransactionId: proposalId,
          memberId: member.id,
          approvalType: 'REJECT'
        }
      });

      // Update proposal status to rejected
      await prisma.multisigTransaction.update({
        where: { id: proposalId },
        data: { status: 'REJECTED' }
      });

      console.log(`❌ Proposal ${proposalId} rejected by ${memberPublicKey}`);

      return true;

    } catch (error) {
      console.error('Error rejecting proposal:', error);
      throw error;
    }
  }

  /**
   * Check if a proposal can be executed based on time lock
   */
  private canExecuteProposal(proposal: any): { canExecute: boolean; reason?: string; timeRemaining?: number } {
    if (!proposal.multisig.timeLock || proposal.multisig.timeLock === 0) {
      return { canExecute: true };
    }

    // Find the latest approval timestamp
    const latestApproval = proposal.approvals.reduce((latest: any, approval: any) => {
      return approval.createdAt > latest.createdAt ? approval : latest;
    }, proposal.approvals[0]);

    if (!latestApproval) {
      return { canExecute: false, reason: 'No approvals found' };
    }

    const approvalTime = new Date(latestApproval.createdAt).getTime();
    const currentTime = Date.now();
    const timeElapsed = Math.floor((currentTime - approvalTime) / 1000); // Convert to seconds
    const timeRemaining = proposal.multisig.timeLock - timeElapsed;

    if (timeRemaining > 0) {
      return {
        canExecute: false,
        reason: `Time lock not expired. ${timeRemaining} seconds remaining`,
        timeRemaining
      };
    }

    return { canExecute: true };
  }

  /**
   * Get time lock status for a proposal
   */
  async getProposalTimeLockStatus(proposalId: number): Promise<{
    canExecute: boolean;
    timeLock: number;
    timeRemaining?: number;
    reason?: string;
    latestApprovalTime?: Date;
  }> {
    try {
      const proposal = await prisma.multisigTransaction.findUnique({
        where: { id: proposalId },
        include: {
          multisig: true,
          approvals: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const timeLockStatus = this.canExecuteProposal(proposal);
      const latestApproval = proposal.approvals[0];

      return {
        canExecute: timeLockStatus.canExecute,
        timeLock: proposal.multisig.timeLock,
        timeRemaining: timeLockStatus.timeRemaining,
        reason: timeLockStatus.reason,
        latestApprovalTime: latestApproval?.createdAt
      };
    } catch (error) {
      console.error('Error getting proposal time lock status:', error);
      throw new Error(`Failed to get time lock status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute an approved proposal
   */
  async executeProposal(proposalId: number, executorPublicKey: string): Promise<boolean> {
    try {
      const proposal = await prisma.multisigTransaction.findUnique({
        where: { id: proposalId },
        include: {
          multisig: true,
          approvals: true
        }
      });

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      if (proposal.status !== 'APPROVED') {
        throw new Error('Proposal must be approved before execution');
      }

      // Check time lock before execution
      const timeLockStatus = this.canExecuteProposal(proposal);
      if (!timeLockStatus.canExecute) {
        throw new Error(`Cannot execute proposal: ${timeLockStatus.reason}`);
      }

      // Check if executor is a member
      const member = await prisma.multisigMember.findFirst({
        where: {
          publicKey: executorPublicKey,
          isActive: true
        }
      });

      if (!member) {
        throw new Error('Executor must be a multisig member');
      }

      // Simulate transaction execution
      const transactionHash = `EXEC_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;

      // Update proposal status
      await prisma.multisigTransaction.update({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          transactionHash: transactionHash
        }
      });

      console.log(`🚀 Proposal ${proposalId} executed by ${executorPublicKey}`);
      console.log(`   Transaction Hash: ${transactionHash}`);

      return true;

    } catch (error) {
      console.error('Error executing proposal:', error);
      throw error;
    }
  }

  /**
   * Get proposal status
   */
  async getProposalStatus(proposalId: number): Promise<any> {
    try {
      const proposal = await prisma.multisigTransaction.findUnique({
        where: { id: proposalId },
        include: {
          multisig: true,
          proposals: true,
          approvals: {
            include: {
              member: true
            }
          }
        }
      });

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      // Get time lock status
      const timeLockStatus = this.canExecuteProposal(proposal);

      return {
        id: proposal.id,
        status: proposal.status,
        fromWallet: proposal.fromWallet,
        toWallet: proposal.toWallet,
        amount: proposal.amount,
        currency: proposal.currency,
        memo: proposal.memo,
        transactionHash: proposal.transactionHash,
        approvals: proposal.approvals.length,
        threshold: proposal.multisig.threshold,
        timeLock: proposal.multisig.timeLock,
        canExecute: timeLockStatus.canExecute,
        timeRemaining: timeLockStatus.timeRemaining,
        timeLockReason: timeLockStatus.reason,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      };

    } catch (error) {
      console.error('Error getting proposal status:', error);
      throw error;
    }
  }

  /**
   * Create a multisig transaction proposal for yield investment
   */
  async createYieldInvestmentProposal(request: YieldInvestmentProposalRequest): Promise<MultisigProposalResult> {
    try {
      // Validate request
      if (!request.owner) {
        throw new Error('Owner address is required');
      }

      // For referrer_init, amount can be 0
      if (request.type !== 'referrer_init' && (!request.amount || request.amount <= 0)) {
        throw new Error('Invalid amount');
      }

      if (!request.transaction) {
        throw new Error('Transaction is required');
      }

      // Get main multisig PDA
      const multisigPda = await MultisigService.getMainMultisigPda();
      if (!multisigPda) {
        throw new Error('No main multisig found. Please create a multisig first.');
      }

      // Get multisig from database
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

      if (multisig.members.length === 0) {
        throw new Error('No active members found for multisig');
      }

      // Create proposal in database
      const proposal = await prisma.multisigTransferProposal.create({
        data: {
          fromWallet: request.owner,
          toWallet: 'LULO_YIELD_POOL',
          amount: request.amount,
          netAmount: request.amount,
          fee: 0,
          currency: 'USDC',
          status: 'PENDING',
          requestedBy: request.userId.toString(),
          multisigPda: multisigPda,
          notes: request.type === 'referrer_init' 
            ? 'Initialize referrer account for boosted yield'
            : `Boosted yield investment: ${request.type} - ${request.amount} USDC`,
          transactionData: JSON.stringify(request.transaction) // Store Lulo instructions
        }
      });

      return {
        proposalId: proposal.id,
        multisigPda,
        transactionIndex: proposal.id.toString(),
        status: 'PENDING',
        message: `Boosted yield investment proposal created successfully. Proposal ID: ${proposal.id}`
      };

    } catch (error) {
      console.error('Error creating yield investment proposal:', error);
      throw new Error(`Failed to create yield investment proposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a multisig transaction proposal for yield withdrawal
   */
  async createYieldWithdrawalProposal(request: YieldWithdrawalProposalRequest): Promise<MultisigProposalResult> {
    try {
      // Validate request
      if (!request.owner) {
        throw new Error('Owner address is required');
      }

      if (!request.transaction) {
        throw new Error('Transaction is required');
      }

      // Get main multisig PDA
      const multisigPda = await MultisigService.getMainMultisigPda();
      if (!multisigPda) {
        throw new Error('No main multisig found. Please create a multisig first.');
      }

      // Get multisig from database
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

      if (multisig.members.length === 0) {
        throw new Error('No active members found for multisig');
      }

      // Create proposal in database
      const proposal = await prisma.multisigTransferProposal.create({
        data: {
          fromWallet: 'LULO_YIELD_POOL',
          toWallet: request.owner,
          amount: request.amount,
          netAmount: request.amount,
          fee: 0,
          currency: 'USDC',
          status: 'PENDING',
          requestedBy: request.userId.toString(),
          multisigPda: multisigPda,
          notes: `Boosted yield withdrawal: ${request.type} - ${request.amount} USDC`,
          transactionData: JSON.stringify(request.transaction) // Store Lulo instructions
        }
      });

      return {
        proposalId: proposal.id,
        multisigPda,
        transactionIndex: proposal.id.toString(),
        status: 'PENDING',
        message: `Boosted yield withdrawal proposal created successfully. Proposal ID: ${proposal.id}`
      };

    } catch (error) {
      console.error('Error creating yield withdrawal proposal:', error);
      throw new Error(`Failed to create yield withdrawal proposal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

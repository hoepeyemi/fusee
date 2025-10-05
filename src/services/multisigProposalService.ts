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
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      };

    } catch (error) {
      console.error('Error getting proposal status:', error);
      throw error;
    }
  }
}

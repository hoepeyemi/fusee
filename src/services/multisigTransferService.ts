/**
 * Multisig Transfer Service
 * 
 * This service handles wallet transfers that require multisig approval
 * when transferring between users in the app.
 */

import { prisma } from '../lib/prisma';
import { MultisigService } from './multisigService';
import { adminInactivityService } from './adminInactivityService';

export interface MultisigTransferRequest {
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency?: string;
  notes?: string;
  requestedBy: string; // Public key of the requester
}

export interface MultisigTransferProposal {
  id: number;
  fromWallet: string;
  toWallet: string;
  amount: number;
  netAmount: number;
  fee: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  requestedBy: string;
  multisigPda: string;
  proposalId?: string;
  transactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MultisigTransferService {
  private static readonly FEE_RATE = 0.00001; // 0.001% = 0.00001

  /**
   * Check if a wallet address belongs to a user in the app
   */
  public static async isUserWallet(walletAddress: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { solanaWallet: walletAddress }
      });
      return user !== null;
    } catch (error) {
      console.error('Error checking if wallet belongs to user:', error);
      return false;
    }
  }

  /**
   * Get user by wallet address
   */
  public static async getUserByWallet(walletAddress: string) {
    try {
      return await prisma.user.findUnique({
        where: { solanaWallet: walletAddress }
      });
    } catch (error) {
      console.error('Error getting user by wallet:', error);
      return null;
    }
  }

  /**
   * Check if transfer requires multisig approval
   */
  public static async requiresMultisigApproval(
    fromWallet: string,
    toWallet: string
  ): Promise<boolean> {
    const fromIsUser = await this.isUserWallet(fromWallet);
    
    // Require multisig approval if the source wallet belongs to a user
    // This covers both user-to-user and user-to-external transfers
    return fromIsUser;
  }

  /**
   * Calculate transfer fee
   */
  public static calculateFee(amount: number): { fee: number; netAmount: number } {
    const fee = amount * this.FEE_RATE;
    const netAmount = amount - fee;
    
    return {
      fee: Math.max(fee, 0),
      netAmount: Math.max(netAmount, 0)
    };
  }

  /**
   * Create a multisig transfer proposal
   */
  public static async createTransferProposal(
    request: MultisigTransferRequest
  ): Promise<MultisigTransferProposal> {
    try {
      // Check if transfer requires multisig approval
      const requiresApproval = await this.requiresMultisigApproval(
        request.fromWallet,
        request.toWallet
      );

      if (!requiresApproval) {
        throw new Error('Transfer does not require multisig approval (source wallet is not a user)');
      }

      // Get the multisig service
      const multisigService = new MultisigService({
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        threshold: 2, // Will be updated based on user's multisig config
        members: []
      });

      // Get user's multisig configuration
      const fromUser = await this.getUserByWallet(request.fromWallet);
      if (!fromUser) {
        throw new Error('Source user not found');
      }
      
      if (!fromUser.hasMultisig) {
        throw new Error('Source user does not have multisig configured');
      }

      const { fee, netAmount } = this.calculateFee(request.amount);

      // Create transfer proposal in database
      const proposal = await prisma.multisigTransferProposal.create({
        data: {
          fromWallet: request.fromWallet,
          toWallet: request.toWallet,
          amount: request.amount,
          netAmount,
          fee,
          currency: request.currency || 'USDC',
          status: 'PENDING',
          requestedBy: request.requestedBy,
          multisigPda: fromUser.multisigPda!,
          notes: request.notes
        }
      });

      console.log(`📝 Created multisig transfer proposal: ${proposal.id}`);
      console.log(`   From: ${request.fromWallet}`);
      console.log(`   To: ${request.toWallet}`);
      console.log(`   Amount: ${request.amount} ${request.currency || 'USDC'}`);
      console.log(`   Multisig: ${fromUser.multisigPda}`);

      // Update admin activity for the requester
      try {
        await adminInactivityService.updateAdminActivity(request.requestedBy);
      } catch (activityError) {
        console.warn('⚠️ Failed to update admin activity:', activityError);
      }

      return {
        id: proposal.id,
        fromWallet: proposal.fromWallet,
        toWallet: proposal.toWallet,
        amount: Number(proposal.amount),
        netAmount: Number(proposal.netAmount),
        fee: Number(proposal.fee),
        currency: proposal.currency,
        status: proposal.status as any,
        requestedBy: proposal.requestedBy,
        multisigPda: proposal.multisigPda,
        proposalId: proposal.proposalId || undefined,
        transactionHash: proposal.transactionHash || undefined,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      };
    } catch (error) {
      console.error('Error creating multisig transfer proposal:', error);
      throw error;
    }
  }

  /**
   * Get all pending transfer proposals
   */
  public static async getPendingProposals(): Promise<MultisigTransferProposal[]> {
    try {
      const proposals = await prisma.multisigTransferProposal.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' }
      });

      return proposals.map(proposal => ({
        id: proposal.id,
        fromWallet: proposal.fromWallet,
        toWallet: proposal.toWallet,
        amount: Number(proposal.amount),
        netAmount: Number(proposal.netAmount),
        fee: Number(proposal.fee),
        currency: proposal.currency,
        status: proposal.status as any,
        requestedBy: proposal.requestedBy,
        multisigPda: proposal.multisigPda,
        proposalId: proposal.proposalId || undefined,
        transactionHash: proposal.transactionHash || undefined,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      }));
    } catch (error) {
      console.error('Error getting pending proposals:', error);
      throw error;
    }
  }

  /**
   * Get transfer proposal by ID
   */
  public static async getProposalById(id: number): Promise<MultisigTransferProposal | null> {
    try {
      const proposal = await prisma.multisigTransferProposal.findUnique({
        where: { id }
      });

      if (!proposal) return null;

      return {
        id: proposal.id,
        fromWallet: proposal.fromWallet,
        toWallet: proposal.toWallet,
        amount: Number(proposal.amount),
        netAmount: Number(proposal.netAmount),
        fee: Number(proposal.fee),
        currency: proposal.currency,
        status: proposal.status as any,
        requestedBy: proposal.requestedBy,
        multisigPda: proposal.multisigPda,
        proposalId: proposal.proposalId || undefined,
        transactionHash: proposal.transactionHash || undefined,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      };
    } catch (error) {
      console.error('Error getting proposal by ID:', error);
      throw error;
    }
  }

  /**
   * Approve a transfer proposal
   */
  public static async approveProposal(
    proposalId: number,
    approverPublicKey: string
  ): Promise<boolean> {
    try {
      const proposal = await prisma.multisigTransferProposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        throw new Error('Transfer proposal not found');
      }

      if (proposal.status !== 'PENDING') {
        throw new Error('Proposal is not pending approval');
      }

      // Update proposal status to approved
      await prisma.multisigTransferProposal.update({
        where: { id: proposalId },
        data: {
          status: 'APPROVED',
          updatedAt: new Date()
        }
      });

      // Update admin activity
      try {
        await adminInactivityService.updateAdminActivity(approverPublicKey);
      } catch (activityError) {
        console.warn('⚠️ Failed to update admin activity:', activityError);
      }

      console.log(`✅ Transfer proposal ${proposalId} approved by ${approverPublicKey}`);
      return true;
    } catch (error) {
      console.error('Error approving proposal:', error);
      throw error;
    }
  }

  /**
   * Reject a transfer proposal
   */
  public static async rejectProposal(
    proposalId: number,
    rejectorPublicKey: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const proposal = await prisma.multisigTransferProposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        throw new Error('Transfer proposal not found');
      }

      if (proposal.status !== 'PENDING') {
        throw new Error('Proposal is not pending approval');
      }

      // Update proposal status to rejected
      await prisma.multisigTransferProposal.update({
        where: { id: proposalId },
        data: {
          status: 'REJECTED',
          notes: reason ? `${proposal.notes || ''}\nRejection reason: ${reason}`.trim() : proposal.notes,
          updatedAt: new Date()
        }
      });

      // Update admin activity
      try {
        await adminInactivityService.updateAdminActivity(rejectorPublicKey);
      } catch (activityError) {
        console.warn('⚠️ Failed to update admin activity:', activityError);
      }

      console.log(`❌ Transfer proposal ${proposalId} rejected by ${rejectorPublicKey}`);
      if (reason) {
        console.log(`   Reason: ${reason}`);
      }
      return true;
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      throw error;
    }
  }

  /**
   * Execute an approved transfer proposal
   */
  public static async executeProposal(
    proposalId: number,
    executorPublicKey: string
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const proposal = await prisma.multisigTransferProposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        throw new Error('Transfer proposal not found');
      }

      if (proposal.status !== 'APPROVED') {
        throw new Error('Proposal must be approved before execution');
      }

      // Here you would implement the actual blockchain transfer
      // For now, we'll simulate the transfer
      const simulatedTransactionHash = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update proposal status to executed
      await prisma.multisigTransferProposal.update({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          transactionHash: simulatedTransactionHash,
          updatedAt: new Date()
        }
      });

      // Update admin activity
      try {
        await adminInactivityService.updateAdminActivity(executorPublicKey);
      } catch (activityError) {
        console.warn('⚠️ Failed to update admin activity:', activityError);
      }

      console.log(`🚀 Transfer proposal ${proposalId} executed by ${executorPublicKey}`);
      console.log(`   Transaction hash: ${simulatedTransactionHash}`);

      return {
        success: true,
        transactionHash: simulatedTransactionHash
      };
    } catch (error) {
      console.error('Error executing proposal:', error);
      
      // Update proposal status to failed
      try {
        await prisma.multisigTransferProposal.update({
          where: { id: proposalId },
          data: {
            status: 'FAILED',
            updatedAt: new Date()
          }
        });
      } catch (updateError) {
        console.error('Error updating proposal status to failed:', updateError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transfer proposals by status
   */
  public static async getProposalsByStatus(
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED'
  ): Promise<MultisigTransferProposal[]> {
    try {
      const proposals = await prisma.multisigTransferProposal.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' }
      });

      return proposals.map(proposal => ({
        id: proposal.id,
        fromWallet: proposal.fromWallet,
        toWallet: proposal.toWallet,
        amount: Number(proposal.amount),
        netAmount: Number(proposal.netAmount),
        fee: Number(proposal.fee),
        currency: proposal.currency,
        status: proposal.status as any,
        requestedBy: proposal.requestedBy,
        multisigPda: proposal.multisigPda,
        proposalId: proposal.proposalId || undefined,
        transactionHash: proposal.transactionHash || undefined,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      }));
    } catch (error) {
      console.error('Error getting proposals by status:', error);
      throw error;
    }
  }

  /**
   * Get transfer statistics
   */
  public static async getTransferStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    executed: number;
    failed: number;
  }> {
    try {
      const stats = await prisma.multisigTransferProposal.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });

      const result = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        executed: 0,
        failed: 0
      };

      stats.forEach(stat => {
        const count = stat._count.id;
        result.total += count;
        result[stat.status.toLowerCase() as keyof typeof result] = count;
      });

      return result;
    } catch (error) {
      console.error('Error getting transfer stats:', error);
      throw error;
    }
  }
}

export default MultisigTransferService;

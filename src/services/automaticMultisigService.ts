import { prisma } from '../lib/prisma';
import { MultisigService } from './multisigService';
import { MultisigProposalService } from './multisigProposalService';
import { MultisigTransferService } from './multisigTransferService';
import { getMultisigConfig } from '../config/environment';

export interface AutomaticExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  proposalId: number;
  status: string;
  executedBy: string[];
}

export class AutomaticMultisigService {
  private static instance: AutomaticMultisigService;

  private constructor() {}

  static getInstance(): AutomaticMultisigService {
    if (!AutomaticMultisigService.instance) {
      AutomaticMultisigService.instance = new AutomaticMultisigService();
    }
    return AutomaticMultisigService.instance;
  }

  /**
   * Automatically execute a multisig proposal by having all members sign and execute
   */
  async executeProposalAutomatically(proposalId: number): Promise<AutomaticExecutionResult> {
    try {
      console.log(`🤖 Starting automatic execution for proposal ${proposalId}...`);

      // Get the proposal details
      const proposal = await prisma.multisigTransferProposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`);
      }

      if (proposal.status !== 'PENDING') {
        return {
          success: false,
          error: `Proposal ${proposalId} is not pending (status: ${proposal.status})`,
          proposalId,
          status: proposal.status,
          executedBy: []
        };
      }

      // Get multisig configuration
      const multisigConfig = getMultisigConfig();
      
      // Get only admin members (those with Voter/Executor permissions) for this multisig PDA
      const allMembers = await prisma.multisigMember.findMany({
        where: {
          multisigId: null, // Global multisig members
          isActive: true
        }
      });

      // Filter to only admin members (Vote or Execute permissions)
      const members = allMembers.filter(member => {
        try {
          const permissions = JSON.parse(member.permissions || '[]');
          // Check for Squads SDK permission objects or string permissions
          return permissions.some((perm: any) => 
            (typeof perm === 'object' && perm.name === 'Vote') ||
            (typeof perm === 'object' && perm.name === 'Execute') ||
            (typeof perm === 'string' && perm === 'Vote') ||
            (typeof perm === 'string' && perm === 'Execute') ||
            (typeof perm === 'string' && perm === 'Voter') ||
            (typeof perm === 'string' && perm === 'Executor')
          );
        } catch (error) {
          console.error('Error parsing member permissions:', error);
          return false;
        }
      });

      if (members.length === 0) {
        throw new Error(`No active admin members (Voter/Executor) found for multisig ${proposal.multisigPda}`);
      }

      console.log(`👥 Found ${members.length} active admin members for automatic execution`);

      // Create multisig service instance
      const multisigService = new MultisigService({
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        threshold: multisigConfig.defaultThreshold,
        multisigPda: proposal.multisigPda,
        members: members.map(m => ({
          publicKey: m.publicKey,
          permissions: JSON.parse(m.permissions || '[]')
        }))
      });

      // Get the proposal service
      const proposalService = MultisigProposalService.getInstance();

      // Step 1: Have all members approve the proposal
      console.log(`📝 Getting all members to approve proposal ${proposalId}...`);
      const approvalResults = [];
      
      for (const member of members) {
        try {
          console.log(`✅ Member ${member.publicKey} approving proposal...`);
          await proposalService.approveProposal(proposalId, member.publicKey);
          approvalResults.push(member.publicKey);
          console.log(`✅ Member ${member.publicKey} approved successfully`);
        } catch (approvalError) {
          console.log(`❌ Member ${member.publicKey} approval failed:`, approvalError.message);
          // Continue with other members
        }
      }

      if (approvalResults.length === 0) {
        throw new Error('No members were able to approve the proposal');
      }

      console.log(`✅ ${approvalResults.length}/${members.length} members approved the proposal`);

      // Step 2: Check if we have enough approvals
      const updatedProposal = await prisma.multisigTransferProposal.findUnique({
        where: { id: proposalId }
      });

      if (!updatedProposal) {
        throw new Error('Proposal not found after approval');
      }

      // Since MultisigTransferProposal doesn't have approvals relation, we'll assume approval
      // In a real implementation, you'd need to track approvals separately
      const approvalCount = approvalResults.length;
      const threshold = multisigConfig.defaultThreshold;

      if (approvalCount < threshold) {
        return {
          success: false,
          error: `Insufficient approvals: ${approvalCount}/${threshold}`,
          proposalId,
          status: 'PENDING',
          executedBy: approvalResults
        };
      }

      console.log(`✅ Proposal has sufficient approvals: ${approvalCount}/${threshold}`);

      // Step 3: Execute the proposal
      console.log(`🚀 Executing proposal ${proposalId}...`);
      
      // Find a member with execute permissions
      const executor = members.find(m => {
        const permissions = JSON.parse(m.permissions || '[]');
        return permissions.includes('execute') || permissions.includes('Executor');
      });

      if (!executor) {
        throw new Error('No member with execute permissions found');
      }

      console.log(`👤 Executing with member: ${executor.publicKey}`);

      // Execute the proposal
      const executionResult = await MultisigTransferService.executeProposal(
        proposalId,
        executor.publicKey
      );

      if (executionResult.success) {
        console.log(`✅ Proposal ${proposalId} executed successfully`);
        console.log(`   Transaction: ${executionResult.transactionHash}`);
        
        return {
          success: true,
          transactionHash: executionResult.transactionHash,
          proposalId,
          status: 'EXECUTED',
          executedBy: approvalResults
        };
      } else {
        throw new Error(`Execution failed: ${executionResult.error}`);
      }

    } catch (error) {
      console.error(`❌ Automatic execution failed for proposal ${proposalId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        proposalId,
        status: 'FAILED',
        executedBy: []
      };
    }
  }

  /**
   * Process all pending proposals automatically
   */
  async processAllPendingProposals(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: AutomaticExecutionResult[];
  }> {
    try {
      console.log(`🤖 Processing all pending multisig proposals...`);

      // Get all pending proposals
      const pendingProposals = await prisma.multisigTransferProposal.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`📋 Found ${pendingProposals.length} pending proposals`);

      const results: AutomaticExecutionResult[] = [];
      let successful = 0;
      let failed = 0;

      for (const proposal of pendingProposals) {
        try {
          const result = await this.executeProposalAutomatically(proposal.id);
          results.push(result);
          
          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`❌ Failed to process proposal ${proposal.id}:`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            proposalId: proposal.id,
            status: 'FAILED',
            executedBy: []
          });
          failed++;
        }
      }

      console.log(`✅ Processed ${pendingProposals.length} proposals: ${successful} successful, ${failed} failed`);

      return {
        processed: pendingProposals.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('❌ Error processing pending proposals:', error);
      throw error;
    }
  }

  /**
   * Get the status of a specific proposal
   */
  async getProposalStatus(proposalId: number): Promise<{
    proposalId: number;
    status: string;
    approvals: number;
    threshold: number;
    canExecute: boolean;
    executedBy?: string[];
    transactionHash?: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      const proposal = await prisma.multisigTransferProposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`);
      }

      // Get multisig configuration for threshold
      const multisigConfig = getMultisigConfig();
      
      // Since MultisigTransferProposal doesn't have approvals relation,
      // we'll use a simplified approach
      const approvalCount = 0; // Would need separate tracking in real implementation
      const threshold = multisigConfig.defaultThreshold;
      const canExecute = proposal.status === 'PENDING'; // Basic check

      return {
        proposalId: proposal.id,
        status: proposal.status,
        approvals: approvalCount,
        threshold,
        canExecute,
        executedBy: [], // Would need separate tracking
        transactionHash: proposal.transactionHash || undefined,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt
      };

    } catch (error) {
      console.error(`❌ Error getting proposal status for ${proposalId}:`, error);
      throw error;
    }
  }
}

export default AutomaticMultisigService;

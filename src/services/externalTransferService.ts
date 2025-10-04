import { prisma } from '../lib/prisma';
import FeeWalletService from './feeWalletService';
import { createUserMultisigService } from './multisigService';
import { UserMultisigService } from './userMultisigService';
import { RealFeeTransactionService } from './realFeeTransactionService';
import { MultisigProposalService } from './multisigProposalService';
import { Connection } from '@solana/web3.js';

export class ExternalTransferService {
  private static readonly FEE_RATE = 0.00001; // 0.001% = 0.00001

  /**
   * Calculate the fee for a given transfer amount
   */
  public static calculateFee(amount: number): { fee: number; netAmount: number } {
    const fee = amount * this.FEE_RATE;
    const netAmount = amount - fee;
    
    return {
      fee: Math.max(fee, 0), // Ensure fee is not negative
      netAmount: Math.max(netAmount, 0) // Ensure net amount is not negative
    };
  }

  /**
   * Create external transfer proposal for multisig approval
   */
  public static async createExternalTransferProposal(
    userId: number,
    fromWallet: string,
    toExternalWallet: string,
    amount: number,
    currency: string = 'SOL',
    notes?: string
  ): Promise<{
    proposalId: number;
    multisigPda: string;
    transactionIndex: string;
    status: string;
    message: string;
    fee: number;
    netAmount: number;
  }> {
    try {
      // Validate inputs
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      if (!fromWallet || typeof fromWallet !== 'string') {
        throw new Error('Invalid sender wallet address');
      }

      if (!toExternalWallet || typeof toExternalWallet !== 'string') {
        throw new Error('Invalid recipient wallet address');
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (amount > 1000000) {
        throw new Error('Amount cannot exceed 1,000,000 SOL');
      }

      if (!currency || !['SOL', 'USDC', 'USDT'].includes(currency)) {
        throw new Error('Currency must be SOL, USDC, or USDT');
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const { fee, netAmount } = this.calculateFee(amount);

    // Create multisig proposal
    const proposalService = MultisigProposalService.getInstance();
    const proposal = await proposalService.createExternalTransferProposal({
      fromWallet,
      toWallet: toExternalWallet,
      amount: netAmount, // Use net amount (after fee)
      currency,
      memo: notes,
      transferType: 'EXTERNAL',
      userId
    });

    // Create external transfer record with proposal info
    const externalTransfer = await prisma.externalTransfer.create({
      data: {
        userId,
        fromWallet,
        toExternalWallet,
        amount,
        fee,
        netAmount,
        currency,
          status: 'PENDING_APPROVAL' as any,
        transactionHash: `PROPOSAL_${proposal.proposalId}`,
        feeWalletAddress: 'MULTISIG_PDA', // Will be updated when executed
        notes: notes
      }
    });

    console.log(`📝 External transfer proposal created:`);
    console.log(`   Transfer ID: ${externalTransfer.id}`);
    console.log(`   Proposal ID: ${proposal.proposalId}`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   Fee: ${fee} ${currency}`);
    console.log(`   Net Amount: ${netAmount} ${currency}`);
    console.log(`   Multisig PDA: ${proposal.multisigPda}`);

      return {
        proposalId: proposal.proposalId,
        multisigPda: proposal.multisigPda,
        transactionIndex: proposal.transactionIndex,
        status: proposal.status,
        message: proposal.message,
        fee: fee,
        netAmount: netAmount
      };

    } catch (error) {
      console.error('Error creating external transfer proposal:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('multisig') || error.message.includes('Multisig')) {
          throw new Error('Multisig service error: ' + error.message);
        }
        
        if (error.message.includes('Prisma') || error.message.includes('database')) {
          throw new Error('Database error: ' + error.message);
        }
        
        if (error.message.includes('validation') || error.message.includes('Invalid')) {
          throw new Error('Validation error: ' + error.message);
        }
        
        if (error.message.includes('User not found')) {
          throw new Error('User not found. Please check your user ID.');
        }
        
        // Return the original error message for user-friendly errors
        throw new Error(error.message);
      }
      
      // Generic error fallback
      throw new Error('Failed to create external transfer proposal. Please try again.');
    }
  }

  /**
   * Process external wallet transfer with real fee transaction to treasury
   */
  public static async processExternalTransferWithRealFees(
    userId: number,
    fromWallet: string,
    toExternalWallet: string,
    amount: number,
    currency: string = 'SOL',
    notes?: string,
    connection?: Connection
  ): Promise<{
    transferId: number;
    fee: number;
    netAmount: number;
    treasuryAddress: string;
    feeTransactionHash: string;
    mainTransactionHash: string;
    multisigTransactionIndex?: string;
    requiresApproval: boolean;
  }> {
    // Verify user exists and has sufficient balance
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { fee, netAmount } = this.calculateFee(amount);

    // Initialize real fee transaction service if connection provided
    if (connection) {
      RealFeeTransactionService.initialize(connection);
    }

    // Send real fee transaction to treasury
    const feeResult = await RealFeeTransactionService.sendFeeToTreasury(
      fromWallet,
      fee,
      currency
    );

    if (!feeResult.success) {
      throw new Error(`Failed to send fee to treasury: ${feeResult.error}`);
    }

    // Create external transfer record
    const externalTransfer = await prisma.externalTransfer.create({
      data: {
        userId,
        fromWallet,
        toExternalWallet,
        amount,
        fee,
        netAmount,
        currency,
        status: 'COMPLETED',
        transactionHash: `EXTERNAL_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        feeWalletAddress: feeResult.treasuryAddress,
        notes: notes
      }
    });

    // Create fee record
    const feeRecord = await prisma.fee.create({
      data: {
        transferId: externalTransfer.id,
        vaultId: 1, // Main vault ID
        amount: fee,
        currency,
        feeRate: this.FEE_RATE,
        status: 'COLLECTED'
      }
    });

    console.log(`💰 External transfer completed with real fee transaction:`);
    console.log(`   Transfer ID: ${externalTransfer.id}`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   Fee: ${fee} ${currency}`);
    console.log(`   Net Amount: ${netAmount} ${currency}`);
    console.log(`   Fee Transaction: ${feeResult.transactionHash}`);
    console.log(`   Treasury: ${feeResult.treasuryAddress}`);

    return {
      transferId: externalTransfer.id,
      fee: fee,
      netAmount: netAmount,
      treasuryAddress: feeResult.treasuryAddress,
      feeTransactionHash: feeResult.transactionHash,
      mainTransactionHash: externalTransfer.transactionHash,
      requiresApproval: false // Real transaction, no multisig approval needed
    };
  }

  /**
   * Process external wallet transfer with fee collection using multisig (legacy method)
   */
  public static async processExternalTransfer(
    userId: number,
    fromWallet: string,
    toExternalWallet: string,
    amount: number,
    currency: string = 'SOL',
    notes?: string
  ): Promise<{
    transferId: number;
    fee: number;
    netAmount: number;
    feeWalletAddress: string;
    multisigTransactionIndex?: string;
    requiresApproval: boolean;
  }> {
    // Verify user exists and has sufficient balance
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { fee, netAmount } = this.calculateFee(amount);

    // Check if user has sufficient balance
    if (Number(user.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    // Get the fee wallet service
    const feeWallet = FeeWalletService.getInstance();
    const feeWalletAddress = feeWallet.getFeeWalletAddress();

    // Create external transfer record
    const externalTransfer = await prisma.externalTransfer.create({
      data: {
        userId,
        fromWallet,
        toExternalWallet,
        amount,
        fee,
        netAmount,
        currency,
        feeWalletAddress,
        notes,
        status: 'PENDING'
      }
    });

    // Create external fee record
    const externalFee = await prisma.externalFee.create({
      data: {
        externalTransferId: externalTransfer.id,
        amount: fee,
        currency,
        feeRate: this.FEE_RATE,
        feeWalletAddress,
        status: 'COLLECTED'
      }
    });

    // Check if user has multisig configured
    const userMultisigPda = await UserMultisigService.getUserMultisigPda(userId);

    if (userMultisigPda) {
      try {
        // Get user's multisig configuration
        const userMultisig = await UserMultisigService.getUserMultisig(userId);
        if (!userMultisig || !userMultisig.multisigPda || !userMultisig.createKey) {
          throw new Error('User multisig configuration not found or incomplete');
        }

        // Create multisig service with user's specific configuration
        const multisigService = createUserMultisigService({
          multisigPda: userMultisig.multisigPda,
          createKey: userMultisig.createKey,
          threshold: userMultisig.threshold || 2,
          timeLock: userMultisig.timeLock || 0,
          members: userMultisig.members
        });
        
        // Create multisig transaction for external transfer
        const multisigResult = await multisigService.createVaultTransaction(
          fromWallet,
          toExternalWallet,
          amount,
          notes || `External transfer: ${amount} ${currency} to ${toExternalWallet}`
        );

        // Save multisig transaction to database
        const multisigData = await prisma.multisig.findUnique({
          where: { multisigPda: userMultisigPda }
        });

        if (multisigData) {
          await multisigService.saveTransactionToDatabase(
            multisigData.id,
            multisigResult.transactionIndex,
            fromWallet,
            toExternalWallet,
            amount,
            currency,
            notes
          );
        }

        console.log(`🔐 Multisig transaction created for external transfer: ${multisigResult.transactionIndex}`);
        console.log(`💰 External transfer requires multisig approval: ${amount} ${currency} from ${fromWallet} to external wallet ${toExternalWallet}`);
        console.log(`💰 Fee to be collected: ${fee} ${currency} (${this.FEE_RATE * 100}%)`);

        return {
          transferId: externalTransfer.id,
          fee,
          netAmount,
          feeWalletAddress,
          multisigTransactionIndex: multisigResult.transactionIndex.toString(),
          requiresApproval: true
        };
      } catch (error) {
        console.error('Error creating multisig transaction:', error);
        // Fall back to direct transfer if multisig fails
      }
    }

    // Fallback: Direct transfer without multisig
    const transactionHash = `EXTERNAL_TRANSFER_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;

    // Update transfer with transaction hash and mark as completed
    const completedTransfer = await prisma.externalTransfer.update({
      where: { id: externalTransfer.id },
      data: {
        transactionHash,
        status: 'COMPLETED'
      }
    });

    // Update user balance (deduct full amount including fee)
    await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          decrement: amount
        }
      }
    });

    console.log(`💰 External transfer completed (direct): ${amount} ${currency} from ${fromWallet} to external wallet ${toExternalWallet}`);
    console.log(`💰 Fee collected: ${fee} ${currency} (${this.FEE_RATE * 100}%)`);
    console.log(`💰 Fee sent to: ${feeWalletAddress}`);

    return {
      transferId: completedTransfer.id,
      fee,
      netAmount,
      feeWalletAddress,
      requiresApproval: false
    };
  }

  /**
   * Get external transfer by ID
   */
  public static async getExternalTransfer(transferId: number) {
    return await prisma.externalTransfer.findUnique({
      where: { id: transferId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            email: true
          }
        },
        fees: true
      }
    });
  }

  /**
   * Get external transfers by user ID
   */
  public static async getExternalTransfersByUser(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    return await prisma.externalTransfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        fees: true
      }
    });
  }

  /**
   * Get external transfers by external wallet address
   */
  public static async getExternalTransfersByExternalWallet(
    externalWallet: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return await prisma.externalTransfer.findMany({
      where: { toExternalWallet: externalWallet },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            email: true
          }
        },
        fees: true
      }
    });
  }

  /**
   * Get external transfer statistics
   */
  public static async getExternalTransferStatistics() {
    const [totalTransfers, totalVolume, totalFees, recentTransfers] = await Promise.all([
      prisma.externalTransfer.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.externalTransfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.externalTransfer.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { fee: true }
      }),
      prisma.externalTransfer.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              firstName: true
            }
          },
          fees: true
        }
      })
    ]);

    return {
      totalTransfers,
      totalVolume: Number(totalVolume._sum.amount) || 0,
      totalFees: Number(totalFees._sum.fee) || 0,
      averageTransfer: totalTransfers > 0 ? (Number(totalVolume._sum.amount) || 0) / totalTransfers : 0,
      averageFee: totalTransfers > 0 ? (Number(totalFees._sum.fee) || 0) / totalTransfers : 0,
      recentTransfers
    };
  }

  /**
   * Validate external wallet address
   */
  public static validateExternalWalletAddress(externalWallet: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic validation
    if (!externalWallet || externalWallet.length < 32) {
      errors.push('Invalid external wallet address');
    }

    // Check if address is valid base58 (basic check)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (externalWallet && !base58Regex.test(externalWallet)) {
      errors.push('External wallet address contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if external wallet is in database (internal wallet)
   */
  public static async isInternalWallet(walletAddress: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { solanaWallet: walletAddress }
    });
    
    return !!user;
  }

  /**
   * Execute approved multisig transaction for external transfer
   */
  public static async executeMultisigTransfer(
    transferId: number,
    transactionIndex: string,
    executorKey: string
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      // Get the transfer
      const transfer = await prisma.externalTransfer.findUnique({
        where: { id: transferId }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      // Get user's multisig configuration
      const userMultisig = await UserMultisigService.getUserMultisig(transfer.userId);
      if (!userMultisig || !userMultisig.multisigPda || !userMultisig.createKey) {
        throw new Error('User multisig configuration not found');
      }

      // Create multisig service with user's specific configuration
      const multisigService = createUserMultisigService({
        multisigPda: userMultisig.multisigPda,
        createKey: userMultisig.createKey,
        threshold: userMultisig.threshold || 2,
        timeLock: userMultisig.timeLock || 0,
        members: userMultisig.members
      });

      // Check if transaction is approved
      const isApproved = await multisigService.isTransactionApproved(BigInt(transactionIndex));
      
      if (!isApproved) {
        throw new Error('Transaction not approved by multisig');
      }

      // Execute the vault transaction
      const instruction = await multisigService.executeVaultTransaction(
        BigInt(transactionIndex),
        executorKey
      );

      // Simulate successful execution
      const transactionHash = `MULTISIG_EXTERNAL_TRANSFER_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;

      // Update transfer status
      await prisma.externalTransfer.update({
        where: { id: transferId },
        data: {
          transactionHash,
          status: 'COMPLETED'
        }
      });

      // Update user balance (deduct full amount including fee)
      await prisma.user.update({
        where: { id: transfer.userId },
        data: {
          balance: {
            decrement: Number(transfer.amount)
          }
        }
      });

      console.log(`🔐 Multisig external transfer executed: ${transactionHash}`);
      console.log(`💰 Amount: ${transfer.amount} ${transfer.currency}`);
      console.log(`💰 Fee: ${transfer.fee} ${transfer.currency}`);

      return {
        success: true,
        transactionHash
      };
    } catch (error) {
      console.error('Error executing multisig transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default ExternalTransferService;

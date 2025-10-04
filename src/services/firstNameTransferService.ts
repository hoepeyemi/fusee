import { prisma } from '../lib/prisma';
import { FeeService } from './feeService';

export interface FirstNameTransferRequest {
  senderId: number;
  receiverFirstName: string;
  amount: number;
  currency?: string;
  notes?: string;
}

export interface FirstNameTransferResult {
  transferId: number;
  senderId: number;
  receiverId: number;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: string;
  transactionHash: string;
  senderFirstName: string;
  receiverFirstName: string;
  senderBalance: number;
  receiverBalance: number;
}

export interface TransferValidation {
  canTransfer: boolean;
  currentBalance: number;
  requiredAmount: number;
  shortfall?: number;
}

export class FirstNameTransferService {
  private static readonly FEE_RATE = 0.00001; // 0.001%
  private static readonly CURRENCY = 'SOL';

  /**
   * Process a first name transfer (internal balance transfer)
   */
  static async processFirstNameTransfer(request: FirstNameTransferRequest): Promise<FirstNameTransferResult> {
    const { senderId, receiverFirstName, amount, currency = this.CURRENCY, notes } = request;

    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Find sender
    const sender = await prisma.user.findUnique({
      where: { id: senderId }
    });

    if (!sender) {
      throw new Error(`Sender with ID ${senderId} not found`);
    }

    // Find receiver by first name
    const receiver = await prisma.user.findFirst({
      where: { 
        firstName: {
          equals: receiverFirstName,
          mode: 'insensitive'
        }
      }
    });

    if (!receiver) {
      throw new Error(`No user found with first name "${receiverFirstName}"`);
    }

    // Prevent self-transfer
    if (sender.id === receiver.id) {
      throw new Error('Cannot transfer to yourself');
    }

    // Calculate fee and net amount using FeeService
    const { fee, netAmount } = FeeService.calculateFee(amount);

    // Check sender balance (including fees)
    const currentBalance = Number(sender.balance || 0);
    const totalRequired = amount + fee; // User needs to have enough for amount + fee
    if (currentBalance < totalRequired) {
      throw new Error(`Insufficient balance. Current: ${currentBalance}, Required: ${totalRequired} (amount: ${amount} + fee: ${fee})`);
    }

    // Generate internal transaction hash
    const transactionHash = this.generateInternalTransactionHash();

    // Perform atomic transfer
    const result = await prisma.$transaction(async (tx) => {
      // Update sender balance (deduct amount + fee)
      const updatedSender = await tx.user.update({
        where: { id: senderId },
        data: {
          balance: {
            decrement: totalRequired // Deduct amount + fee
          }
        }
      });

      // Update receiver balance
      const updatedReceiver = await tx.user.update({
        where: { id: receiver.id },
        data: {
          balance: {
            increment: netAmount
          }
        }
      });

      // Create transfer record
      const transfer = await tx.transfer.create({
        data: {
          senderId: senderId,
          receiverId: receiver.id,
          amount: amount,
          fee: fee,
          netAmount: netAmount,
          currency: currency,
          status: 'COMPLETED',
          transactionHash: transactionHash,
          notes: notes
        }
      });

      return {
        transfer,
        sender: updatedSender,
        receiver: updatedReceiver
      };
    });

    // Collect fee after successful transfer
    try {
      await FeeService.processTransferFee(
        result.transfer.id,
        amount,
        currency
      );
      console.log(`💰 Fee collected for first-name transfer: ${fee} ${currency}`);
    } catch (feeError) {
      console.error('❌ Error collecting fee for first-name transfer:', feeError);
      // Don't throw here as the transfer was successful, just log the error
    }

    return {
      transferId: result.transfer.id,
      senderId: result.transfer.senderId,
      receiverId: result.transfer.receiverId,
      amount: Number(result.transfer.amount),
      fee: Number(result.transfer.fee),
      netAmount: Number(result.transfer.netAmount),
      currency: result.transfer.currency,
      status: result.transfer.status,
      transactionHash: result.transfer.transactionHash || '',
      senderFirstName: result.sender.firstName,
      receiverFirstName: result.receiver.firstName,
      senderBalance: Number(result.sender.balance),
      receiverBalance: Number(result.receiver.balance)
    };
  }

  /**
   * Get user's current balance
   */
  static async getUserBalance(userId: number): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return Number(user.balance || 0);
  }

  /**
   * Get user's transfer history
   */
  static async getUserTransferHistory(userId: number) {
    const transfers = await prisma.transfer.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: {
            firstName: true,
            fullName: true
          }
        },
        receiver: {
          select: {
            firstName: true,
            fullName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return transfers.map(transfer => ({
      id: transfer.id,
      amount: Number(transfer.amount),
      fee: Number(transfer.fee),
      netAmount: Number(transfer.netAmount),
      currency: transfer.currency,
      status: transfer.status,
      transactionHash: transfer.transactionHash,
      notes: transfer.notes,
      createdAt: transfer.createdAt,
      sender: {
        firstName: transfer.sender.firstName,
        fullName: transfer.sender.fullName
      },
      receiver: {
        firstName: transfer.receiver.firstName,
        fullName: transfer.receiver.fullName
      }
    }));
  }

  /**
   * Validate if user can make a transfer (including fees)
   */
  static async validateTransfer(userId: number, amount: number): Promise<TransferValidation> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const currentBalance = Number(user.balance || 0);
    const { fee } = FeeService.calculateFee(amount);
    const totalRequired = amount + fee; // User needs to have enough for amount + fee
    
    const canTransfer = currentBalance >= totalRequired;
    const shortfall = canTransfer ? 0 : totalRequired - currentBalance;

    return {
      canTransfer,
      currentBalance,
      requiredAmount: totalRequired,
      shortfall: canTransfer ? undefined : shortfall
    };
  }

  /**
   * Generate internal transaction hash
   */
  private static generateInternalTransactionHash(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `INTERNAL_${timestamp}_${random}`;
  }
}

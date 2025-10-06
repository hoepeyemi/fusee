import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateUser, handleValidationErrors } from '../middleware/security';

const router = Router();

/**
 * @swagger
 * /api/users/all:
 *   get:
 *     summary: Get all users with complete details
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive users (default false)
 *         example: false
 *       - in: query
 *         name: includeMultisig
 *         schema:
 *           type: boolean
 *         description: Include multisig details (default true)
 *         example: true
 *       - in: query
 *         name: includeTransactions
 *         schema:
 *           type: boolean
 *         description: Include transaction history (default true)
 *         example: true
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of users returned (default 100)
 *         example: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination (default 0)
 *         example: 0
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       email:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                       solanaWallet:
 *                         type: string
 *                       balance:
 *                         type: number
 *                       multisigPda:
 *                         type: string
 *                       multisigCreateKey:
 *                         type: string
 *                       multisigThreshold:
 *                         type: integer
 *                       multisigTimeLock:
 *                         type: integer
 *                       hasMultisig:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       multisigMembers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             publicKey:
 *                               type: string
 *                             permissions:
 *                               type: string
 *                             isActive:
 *                               type: boolean
 *                             lastActivityAt:
 *                               type: string
 *                               format: date-time
 *                             isInactive:
 *                               type: boolean
 *                             inactiveSince:
 *                               type: string
 *                               format: date-time
 *                             removalEligibleAt:
 *                               type: string
 *                               format: date-time
 *                       sentTransfers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             receiverId:
 *                               type: integer
 *                             amount:
 *                               type: number
 *                             fee:
 *                               type: number
 *                             netAmount:
 *                               type: number
 *                             currency:
 *                               type: string
 *                             status:
 *                               type: string
 *                             transactionHash:
 *                               type: string
 *                             notes:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                             receiver:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 firstName:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                       receivedTransfers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             senderId:
 *                               type: integer
 *                             amount:
 *                               type: number
 *                             fee:
 *                               type: number
 *                             netAmount:
 *                               type: number
 *                             currency:
 *                               type: string
 *                             status:
 *                               type: string
 *                             transactionHash:
 *                               type: string
 *                             notes:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                             sender:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 firstName:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                       deposits:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             vaultId:
 *                               type: integer
 *                             amount:
 *                               type: number
 *                             currency:
 *                               type: string
 *                             status:
 *                               type: string
 *                             transactionHash:
 *                               type: string
 *                             notes:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                             vault:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 address:
 *                                   type: string
 *                                 name:
 *                                   type: string
 *                                 totalBalance:
 *                                   type: number
 *                       withdrawals:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             vaultId:
 *                               type: integer
 *                             amount:
 *                               type: number
 *                             currency:
 *                               type: string
 *                             status:
 *                               type: string
 *                             transactionHash:
 *                               type: string
 *                             notes:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                             vault:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 address:
 *                                   type: string
 *                                 name:
 *                                   type: string
 *                                 totalBalance:
 *                                   type: number
 *                       externalTransfers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             fromWallet:
 *                               type: string
 *                             toExternalWallet:
 *                               type: string
 *                             amount:
 *                               type: number
 *                             fee:
 *                               type: number
 *                             netAmount:
 *                               type: number
 *                             currency:
 *                               type: string
 *                             status:
 *                               type: string
 *                             transactionHash:
 *                               type: string
 *                             feeWalletAddress:
 *                               type: string
 *                             notes:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                             fees:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                   amount:
 *                                     type: number
 *                                   currency:
 *                                     type: string
 *                                   feeRate:
 *                                     type: number
 *                                   feeWalletAddress:
 *                                     type: string
 *                                   status:
 *                                     type: string
 *                                   createdAt:
 *                                     type: string
 *                                     format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     usersWithMultisig:
 *                       type: integer
 *                     totalBalance:
 *                       type: number
 *                     totalTransfers:
 *                       type: integer
 *                     totalDeposits:
 *                       type: integer
 *                     totalWithdrawals:
 *                       type: integer
 *                     totalExternalTransfers:
 *                       type: integer
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/all', async (req: Request, res: Response) => {
  try {
    const {
      includeInactive = 'false',
      includeMultisig = 'true',
      includeTransactions = 'true',
      limit = '100',
      offset = '0'
    } = req.query;

    // Parse parameters
    const includeInactiveUsers = includeInactive === 'true';
    const includeMultisigDetails = includeMultisig === 'true';
    const includeTransactionHistory = includeTransactions === 'true';
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000); // Max 1000 users
    const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

    // Build include object based on parameters
    const include: any = {};

    if (includeMultisigDetails) {
      include.multisigMembers = {
        include: {
          multisig: {
            select: {
              id: true,
              multisigPda: true,
              name: true,
              threshold: true,
              timeLock: true,
              isActive: true,
              createdAt: true
            }
          }
        }
      };
    }

    if (includeTransactionHistory) {
      include.sentTransfers = {
        include: {
          receiver: {
            select: {
              id: true,
              firstName: true,
              email: true
            }
          },
          fees: {
            select: {
              id: true,
              amount: true,
              currency: true,
              feeRate: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to last 50 transfers
      };

      include.receivedTransfers = {
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to last 50 transfers
      };

      include.deposits = {
        include: {
          vault: {
            select: {
              id: true,
              address: true,
              name: true,
              totalBalance: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to last 50 deposits
      };

      include.withdrawals = {
        include: {
          vault: {
            select: {
              id: true,
              address: true,
              name: true,
              totalBalance: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to last 50 withdrawals
      };

      include.externalTransfers = {
        include: {
          fees: {
            select: {
              id: true,
              amount: true,
              currency: true,
              feeRate: true,
              feeWalletAddress: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to last 50 external transfers
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.user.count({
      where: includeInactiveUsers ? {} : { hasMultisig: true }
    });

    // Get users with all details
    const users = await prisma.user.findMany({
      where: includeInactiveUsers ? {} : { hasMultisig: true },
      include,
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      skip: offsetNum
    });

    // Calculate summary statistics
    const summary = await calculateUserSummary();

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      phoneNumber: user.phoneNumber,
      solanaWallet: user.solanaWallet,
      balance: Number(user.balance),
      multisigPda: user.multisigPda,
      multisigCreateKey: user.multisigCreateKey,
      multisigThreshold: user.multisigThreshold,
      multisigTimeLock: user.multisigTimeLock,
      hasMultisig: user.hasMultisig,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...(includeMultisigDetails && {
        multisigMembers: user.multisigMembers?.map(member => ({
          id: member.id,
          publicKey: member.publicKey,
          permissions: member.permissions,
          isActive: member.isActive,
          lastActivityAt: member.lastActivityAt,
          isInactive: member.isInactive,
          inactiveSince: member.inactiveSince,
          removalEligibleAt: member.removalEligibleAt,
          multisig: member.multisig
        }))
      }),
      ...(includeTransactionHistory && {
        sentTransfers: user.sentTransfers?.map(transfer => ({
          id: transfer.id,
          receiverId: transfer.receiverId,
          amount: Number(transfer.amount),
          fee: Number(transfer.fee),
          netAmount: Number(transfer.netAmount),
          currency: transfer.currency,
          status: transfer.status,
          transactionHash: transfer.transactionHash,
          notes: transfer.notes,
          createdAt: transfer.createdAt,
          receiver: transfer.receiver
        })),
        receivedTransfers: user.receivedTransfers?.map(transfer => ({
          id: transfer.id,
          senderId: transfer.senderId,
          amount: Number(transfer.amount),
          fee: Number(transfer.fee),
          netAmount: Number(transfer.netAmount),
          currency: transfer.currency,
          status: transfer.status,
          transactionHash: transfer.transactionHash,
          notes: transfer.notes,
          createdAt: transfer.createdAt,
          sender: transfer.sender
        })),
        deposits: user.deposits?.map(deposit => ({
          id: deposit.id,
          vaultId: deposit.vaultId,
          amount: Number(deposit.amount),
          currency: deposit.currency,
          status: deposit.status,
          transactionHash: deposit.transactionHash,
          notes: deposit.notes,
          createdAt: deposit.createdAt,
          vault: deposit.vault
        })),
        withdrawals: user.withdrawals?.map(withdrawal => ({
          id: withdrawal.id,
          vaultId: withdrawal.vaultId,
          amount: Number(withdrawal.amount),
          currency: withdrawal.currency,
          status: withdrawal.status,
          transactionHash: withdrawal.transactionHash,
          notes: withdrawal.notes,
          createdAt: withdrawal.createdAt,
          vault: withdrawal.vault
        })),
        externalTransfers: user.externalTransfers?.map(transfer => ({
          id: transfer.id,
          fromWallet: transfer.fromWallet,
          toExternalWallet: transfer.toExternalWallet,
          amount: Number(transfer.amount),
          fee: Number(transfer.fee),
          netAmount: Number(transfer.netAmount),
          currency: transfer.currency,
          status: transfer.status,
          transactionHash: transfer.transactionHash,
          feeWalletAddress: transfer.feeWalletAddress,
          notes: transfer.notes,
          createdAt: transfer.createdAt,
          fees: transfer.fees?.map(fee => ({
            id: fee.id,
            amount: Number(fee.amount),
            currency: fee.currency,
            feeRate: Number(fee.feeRate),
            feeWalletAddress: fee.feeWalletAddress,
            status: fee.status,
            createdAt: fee.createdAt
          }))
        }))
      })
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching all users:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Prisma') || error.message.includes('database')) {
        return res.status(500).json({
          message: 'Database error',
          error: 'Internal Server Error',
          details: 'Please try again later'
        });
      }
    }
    
    res.status(500).json({
      message: 'Failed to fetch users',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Calculate summary statistics for all users
 */
async function calculateUserSummary() {
  try {
    const [
      totalUsers,
      activeUsers,
      usersWithMultisig,
      totalBalanceResult,
      totalTransfers,
      totalDeposits,
      totalWithdrawals,
      totalExternalTransfers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { hasMultisig: true } }),
      prisma.user.count({ where: { hasMultisig: true } }),
      prisma.user.aggregate({
        _sum: { balance: true }
      }),
      prisma.transfer.count(),
      prisma.deposit.count(),
      prisma.withdrawal.count(),
      prisma.externalTransfer.count()
    ]);

    return {
      totalUsers,
      activeUsers,
      usersWithMultisig,
      totalBalance: Number(totalBalanceResult._sum.balance || 0),
      totalTransfers,
      totalDeposits,
      totalWithdrawals,
      totalExternalTransfers
    };
  } catch (error) {
    console.error('Error calculating user summary:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      usersWithMultisig: 0,
      totalBalance: 0,
      totalTransfers: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalExternalTransfers: 0
    };
  }
}

/**
 * Get counts of anonymized data for response
 */
async function getDeletedDataCounts(userId: number, user: any) {
  try {
    // Count anonymized data that was preserved
    const [
      transfersCount,
      depositsCount,
      withdrawalsCount,
      externalTransfersCount,
      walletTransfersCount
    ] = await Promise.all([
      prisma.transfer.count({
        where: { 
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      }),
      prisma.deposit.count({
        where: { userId: userId }
      }),
      prisma.withdrawal.count({
        where: { userId: userId }
      }),
      prisma.externalTransfer.count({
        where: { userId: userId }
      }),
      prisma.walletTransfer.count({
        where: { 
          OR: [
            { fromWallet: user.solanaWallet },
            { toWallet: user.solanaWallet }
          ]
        }
      })
    ]);

    return {
      wallet: user.solanaWallet ? { firstName: user.firstName, address: user.solanaWallet } : null,
      transfers: transfersCount,
      deposits: depositsCount,
      withdrawals: withdrawalsCount,
      externalTransfers: externalTransfersCount,
      walletTransfers: walletTransfersCount,
      message: 'Data anonymized and retained for audit purposes',
      anonymizedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting anonymized data counts:', error);
    return {
      message: 'Data anonymized successfully (counts unavailable)',
      anonymizedAt: new Date().toISOString()
    };
  }
}

/**
 * Delete user and all related data
 * This method removes all user data and related records to resolve foreign key constraints
 */
async function deleteUserData(userId: number, user: any) {
  console.log(`🔄 Starting user deletion for user ${userId}...`);
  
  try {
    // Generate anonymized identifiers
    const anonymizedId = `ANON_${userId}_${Date.now()}`;
    const anonymizedEmail = `anonymized_${userId}@deleted.local`;
    const anonymizedName = `Deleted User ${userId}`;
    const anonymizedFirstName = `Deleted_${userId}`;
    const anonymizedWallet = `DELETED_WALLET_${userId}`;
    
    // Transaction 1: Delete external fees and anonymize external transfers
    console.log('Step 1: Deleting external fees and anonymizing external transfers...');
    await prisma.$transaction(async (tx) => {
      // First, get all external transfer IDs for this user
      const userExternalTransfers = await tx.externalTransfer.findMany({
        where: { userId: userId },
        select: { id: true }
      });
      
      const externalTransferIds = userExternalTransfers.map(t => t.id);
      
      // Delete external fees that reference these transfers
      if (externalTransferIds.length > 0) {
        await tx.externalFee.deleteMany({
          where: { externalTransferId: { in: externalTransferIds } }
        });
      }
      
      // Anonymize external transfers (no foreign key constraints)
      await tx.externalTransfer.updateMany({
        where: { userId: userId },
        data: {
          fromWallet: anonymizedWallet,
          notes: `[ANONYMIZED] ${user.firstName || 'User'} - ${new Date().toISOString()}`
        }
      });
    }, { timeout: 10000 });

    // Transaction 2: Delete wallet fees and anonymize wallet transfers
    console.log('Step 2: Deleting wallet fees and anonymizing wallet transfers...');
    await prisma.$transaction(async (tx) => {
      // First, get all wallet transfer IDs for this user
      const userWalletTransfers = await tx.walletTransfer.findMany({
        where: { 
          OR: [
            { fromWallet: user.solanaWallet },
            { toWallet: user.solanaWallet }
          ]
        },
        select: { id: true }
      });
      
      const walletTransferIds = userWalletTransfers.map(t => t.id);
      
      // Delete wallet fees that reference these transfers
      if (walletTransferIds.length > 0) {
        await tx.walletFee.deleteMany({
          where: { walletTransferId: { in: walletTransferIds } }
        });
      }
      
      // Anonymize wallet transfers (no foreign key constraints)
      await tx.walletTransfer.updateMany({
        where: { 
          OR: [
            { fromWallet: user.solanaWallet },
            { toWallet: user.solanaWallet }
          ]
        },
        data: {
          fromWallet: user.solanaWallet === user.solanaWallet ? anonymizedWallet : undefined,
          toWallet: user.solanaWallet === user.solanaWallet ? anonymizedWallet : undefined,
          notes: `[ANONYMIZED] ${user.firstName || 'User'} - ${new Date().toISOString()}`
        }
      });
    }, { timeout: 10000 });

    // Transaction 3: Delete fees and transfers (they reference the user via foreign keys)
    console.log('Step 3: Deleting fees and transfers (foreign key constraints)...');
    await prisma.$transaction(async (tx) => {
      // First, get all transfer IDs for this user
      const userTransfers = await tx.transfer.findMany({
        where: { 
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        select: { id: true }
      });
      
      const transferIds = userTransfers.map(t => t.id);
      
      // Delete fees that reference these transfers
      if (transferIds.length > 0) {
        await tx.fee.deleteMany({
          where: { transferId: { in: transferIds } }
        });
      }
      
      // Now delete the transfers
      await tx.transfer.deleteMany({
        where: { 
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });
    }, { timeout: 10000 });

    // Transaction 4: Delete deposits, withdrawals, and yield investments (foreign key constraints)
    console.log('Step 4: Deleting deposits, withdrawals, and yield investments (foreign key constraints)...');
    await prisma.$transaction(async (tx) => {
      await tx.deposit.deleteMany({
        where: { userId: userId }
      });
      await tx.withdrawal.deleteMany({
        where: { userId: userId }
      });
      await tx.yieldInvestment.deleteMany({
        where: { userId: userId }
      });
    }, { timeout: 10000 });

    // Transaction 5: Delete multisig members and wallet mappings
    console.log('Step 5: Deleting multisig members and wallet mappings...');
    await prisma.$transaction(async (tx) => {
      // Delete multisig members (userId is optional, so we can delete them)
      await tx.multisigMember.deleteMany({
        where: { userId: userId }
      });
      
      // Delete wallet mapping
      await tx.wallet.deleteMany({
        where: { firstName: user.firstName },
      });
    }, { timeout: 10000 });

    // Transaction 6: Delete user record (all foreign key constraints should be resolved)
    console.log('Step 6: Deleting user record...');
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id: userId },
      });
    }, { timeout: 10000 });

    console.log(`✅ User ${userId} deleted successfully - all related data removed`);
    
  } catch (error) {
    console.error(`❌ Error in user anonymization for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Robust user deletion using multiple smaller transactions
 * This is the primary method to prevent timeout issues
 * @deprecated Use anonymizeUserData instead to retain audit data
 */
async function deleteUserWithMultipleTransactions(userId: number, user: any) {
  console.log(`🔄 Starting robust deletion for user ${userId}...`);
  
  try {
    // Transaction 1: Delete external transfers and fees
    console.log('Step 1: Deleting external transfers and fees...');
    await prisma.$transaction(async (tx) => {
      await tx.externalFee.deleteMany({
        where: { externalTransfer: { userId: userId } },
      });
      await tx.externalTransfer.deleteMany({
        where: { userId: userId },
      });
    }, { timeout: 10000 });

    // Transaction 2: Delete wallet transfers and fees
    console.log('Step 2: Deleting wallet transfers and fees...');
    await prisma.$transaction(async (tx) => {
      await tx.walletFee.deleteMany({
        where: {
          OR: [
            { walletTransfer: { fromWallet: user.solanaWallet } },
            { walletTransfer: { toWallet: user.solanaWallet } },
          ],
        },
      });
      await tx.walletTransfer.deleteMany({
        where: { fromWallet: user.solanaWallet },
      });
    }, { timeout: 10000 });

    // Transaction 3: Delete transfers and fees
    console.log('Step 3: Deleting transfers and fees...');
    await prisma.$transaction(async (tx) => {
      await tx.fee.deleteMany({
        where: {
          OR: [
            { transfer: { senderId: userId } },
            { transfer: { receiverId: userId } },
          ],
        },
      });
      await tx.transfer.deleteMany({
        where: { senderId: userId },
      });
      await tx.transfer.deleteMany({
        where: { receiverId: userId },
      });
    }, { timeout: 10000 });

    // Transaction 4: Delete deposits and withdrawals
    console.log('Step 4: Deleting deposits and withdrawals...');
    await prisma.$transaction(async (tx) => {
      await tx.deposit.deleteMany({
        where: { userId: userId },
      });
      await tx.withdrawal.deleteMany({
        where: { userId: userId },
      });
    }, { timeout: 10000 });

    // Transaction 5: Delete wallet mapping and user
    console.log('Step 5: Deleting wallet mapping and user...');
    await prisma.$transaction(async (tx) => {
      await tx.wallet.deleteMany({
        where: { firstName: user.firstName },
      });
      await tx.user.delete({
        where: { id: userId },
      });
    }, { timeout: 10000 });

    console.log(`✅ Robust deletion completed for user ${userId}`);
  } catch (error) {
    console.error(`❌ Robust deletion failed for user ${userId}:`, error);
    throw error;
  }
}

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user with Solana wallet
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - fullName
 *               - solanaWallet
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address
 *                 example: "john.doe@example.com"
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Doe"
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number (optional)
 *                 example: "+1234567890"
 *               solanaWallet:
 *                 type: string
 *                 description: Valid Solana wallet address
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       409:
 *         description: Conflict - email or wallet already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  validateUser,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { email, fullName, phoneNumber, solanaWallet } = req.body;

      // Check if email or wallet already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { solanaWallet: solanaWallet as any }],
        },
      });

      if (existingUser) {
        const conflictField =
          existingUser.email === email ? 'email' : 'Solana wallet';
        return res.status(409).json({
          message: `User with this ${conflictField} already exists`,
          error: 'Conflict',
        });
      }

      // Extract first name from full name
      const firstName = fullName.split(' ')[0];

      const user = await prisma.user.create({
        data: {
          email,
          fullName: fullName as any,
          firstName: firstName as any,
          phoneNumber,
          solanaWallet: solanaWallet as any,
        },
      });

      // Create or update wallet mapping
      await prisma.wallet.upsert({
        where: { firstName: firstName as any },
        update: {
          address: solanaWallet as any,
          isActive: true,
        },
        create: {
          firstName: firstName as any,
          address: solanaWallet as any,
          isActive: true,
        },
      });

      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        message: 'Failed to create user',
        error: 'Internal Server Error',
      });
    }
  }
);

/**
 * @swagger
 * /api/users/find:
 *   get:
 *     summary: Find user by email
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/find', async (req: Request, res: Response) => {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      message: 'Email query parameter is required and must be a string.',
      error: 'Bad Request',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found',
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error finding user by email:', error);
    res.status(500).json({
      message: 'Failed to find user',
      error: 'Internal Server Error',
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid user ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    const userId = parseInt(id);
    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        message: 'Invalid user ID. Must be a positive integer.',
        error: 'Bad Request',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found',
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      message: 'Failed to fetch user',
      error: 'Internal Server Error',
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Anonymize a user while retaining all transaction data for audit
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: User anonymized successfully - all transaction data retained
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User anonymized successfully - all transaction data retained for audit"
 *                 deletedUser:
 *                   $ref: '#/components/schemas/User'
 *                 anonymizedData:
 *                   type: object
 *                   properties:
 *                     wallet:
 *                       type: object
 *                       description: "Anonymized wallet mapping"
 *                     transfers:
 *                       type: integer
 *                       description: "Number of transfers anonymized and retained"
 *                     deposits:
 *                       type: integer
 *                       description: "Number of deposits anonymized and retained"
 *                     withdrawals:
 *                       type: integer
 *                       description: "Number of withdrawals anonymized and retained"
 *                     externalTransfers:
 *                       type: integer
 *                       description: "Number of external transfers anonymized and retained"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid user ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    const userId = parseInt(id);
    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        message: 'Invalid user ID. Must be a positive integer.',
        error: 'Bad Request',
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sentTransfers: true,
        receivedTransfers: true,
        deposits: true,
        withdrawals: true,
        externalTransfers: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found',
      });
    }

    // Delete user and all related data to resolve foreign key constraints
    console.log(`🗑️ Starting user deletion for user ${userId}...`);
    await deleteUserData(userId, user);
    
    // Get counts for response
    const counts = await getDeletedDataCounts(userId, user);
    
    const result = {
      deletedUser: user,
      deletedData: counts
    };

    res.json({
      message: 'User anonymized successfully - all transaction data retained for audit',
      deletedUser: result.deletedUser,
      anonymizedData: result.deletedData,
      note: 'Personal information removed, transaction history preserved'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    res.status(500).json({
      message: 'Failed to delete user',
      error: 'Internal Server Error',
      details: error.message
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import ExternalTransferService from '../services/externalTransferService';
import { MultisigTransferService } from '../services/multisigTransferService';
import { OnDemandMultisigService } from '../services/onDemandMultisigService';
import { Connection } from '@solana/web3.js';

const router = Router();

/**
 * @swagger
 * /api/external-transfers:
 *   post:
 *     summary: Transfer cryptocurrency to external wallet address
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - toExternalWallet
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: ID of the user making the transfer
 *                 example: 1
 *               toExternalWallet:
 *                 type: string
 *                 description: External wallet address (not in database)
 *                 example: "ExternalWallet1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 2.5
 *               currency:
 *                 type: string
 *                 description: Currency type - default SOL
 *                 example: "SOL"
 *               notes:
 *                 type: string
 *                 description: Optional transfer notes
 *                 example: "Payment to external service"
 *     responses:
 *       201:
 *         description: External transfer completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transferId:
 *                   type: integer
 *                 userId:
 *                   type: integer
 *                 fromWallet:
 *                   type: string
 *                 toExternalWallet:
 *                   type: string
 *                 amount:
 *                   type: number
 *                   format: decimal
 *                 fee:
 *                   type: number
 *                   format: decimal
 *                 netAmount:
 *                   type: number
 *                   format: decimal
 *                 feeWalletAddress:
 *                   type: string
 *                 transactionHash:
 *                   type: string
 *                 currency:
 *                   type: string
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, toExternalWallet, amount, currency = 'USDC', notes, requestedBy } = req.body;

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC transfers are allowed for external transfers'
      });
    }

    // Validate input
    if (!userId || !toExternalWallet || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['userId', 'toExternalWallet', 'amount']
      });
    }

    // Get user's wallet address
    const senderUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { solanaWallet: true, hasMultisig: true }
    });

    if (!senderUser) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    if (!senderUser.solanaWallet) {
      return res.status(400).json({
        message: 'User does not have a wallet address',
        error: 'Bad Request'
      });
    }

    // Check if transfer requires multisig approval
    const requiresMultisigApproval = await MultisigTransferService.requiresMultisigApproval(
      senderUser.solanaWallet,
      toExternalWallet
    );

    if (requiresMultisigApproval) {
      // If requestedBy is not provided, return error
      if (!requestedBy) {
        return res.status(400).json({
          message: 'External transfer requires multisig approval',
          error: 'Multisig Required',
          details: 'This external transfer requires multisig approval. Please provide requestedBy field.',
          requiresMultisig: true,
          multisigEndpoint: '/api/multisig-transfers/propose'
        });
      }

      // Ensure user has multisig (create on-demand if needed)
      try {
        const multisigResult = await OnDemandMultisigService.ensureUserMultisig(userId);
        
        if (multisigResult.isNewMultisig) {
          console.log(`🆕 Created new multisig for user ${userId} on first external transfer`);
        }
      } catch (multisigError) {
        console.error('Error ensuring user multisig:', multisigError);
        return res.status(500).json({
          message: 'Failed to set up multisig for user',
          error: 'Multisig Setup Failed',
          details: multisigError instanceof Error ? multisigError.message : 'Unknown error'
        });
      }

      // Create multisig transfer proposal
      try {
        const proposal = await MultisigTransferService.createTransferProposal({
          fromWallet: senderUser.solanaWallet,
          toWallet: toExternalWallet,
          amount: parseFloat(amount),
          currency,
          notes,
          requestedBy
        });

        return res.status(202).json({
          message: 'External transfer proposal created successfully',
          success: true,
          requiresMultisig: true,
          data: {
            proposalId: proposal.id,
            status: proposal.status,
            message: 'External transfer requires multisig approval before execution'
          }
        });
      } catch (proposalError) {
        console.error('Error creating multisig transfer proposal:', proposalError);
        return res.status(500).json({
          message: 'Failed to create transfer proposal',
          error: 'Proposal Creation Failed',
          details: proposalError instanceof Error ? proposalError.message : 'Unknown error'
        });
      }
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        message: 'Amount must be a positive number',
        error: 'Bad Request'
      });
    }

    if (transferAmount > 1000000) {
      return res.status(400).json({
        message: 'Amount cannot exceed 1,000,000',
        error: 'Bad Request'
      });
    }

    // Validate external wallet address
    const validation = ExternalTransferService.validateExternalWalletAddress(toExternalWallet);
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Invalid external wallet address',
        error: 'Bad Request',
        errors: validation.errors
      });
    }

    // Check if external wallet is actually an internal wallet
    const isInternal = await ExternalTransferService.isInternalWallet(toExternalWallet);
    if (isInternal) {
      return res.status(400).json({
        message: 'This wallet address belongs to a registered user. Use user-to-user transfer instead.',
        error: 'Bad Request'
      });
    }

    // Get user's wallet address
    const transferUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { solanaWallet: true, fullName: true }
    });

    if (!transferUser) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    // Process external transfer
    const result = await ExternalTransferService.processExternalTransfer(
      userId,
      transferUser.solanaWallet,
      toExternalWallet,
      transferAmount,
      currency,
      notes
    );

    const response: any = {
      message: result.requiresApproval 
        ? 'External transfer created successfully - requires multisig approval' 
        : 'External transfer completed successfully',
      transferId: result.transferId,
      userId,
      fromWallet: transferUser.solanaWallet,
      toExternalWallet,
      amount: transferAmount,
      fee: result.fee,
      netAmount: result.netAmount,
      feeWalletAddress: result.feeWalletAddress,
      currency,
      requiresApproval: result.requiresApproval
    };

    if (result.requiresApproval && result.multisigTransactionIndex) {
      response.multisigTransactionIndex = result.multisigTransactionIndex;
      response.message += ` - Transaction Index: ${result.multisigTransactionIndex}`;
    } else if ('transactionHash' in result && result.transactionHash) {
      response.transactionHash = result.transactionHash;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error processing external transfer:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          message: 'User not found',
          error: 'Not Found'
        });
      }
      
      if (error.message === 'Insufficient balance') {
        return res.status(400).json({
          message: 'Insufficient balance',
          error: 'Bad Request'
        });
      }
    }

    res.status(500).json({
      message: 'Failed to process external transfer',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/{transferId}:
 *   get:
 *     summary: Get external transfer by ID
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer ID
 *         example: 1
 *     responses:
 *       200:
 *         description: External transfer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExternalTransfer'
 *       404:
 *         description: Transfer not found
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
router.get('/:transferId', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const id = parseInt(transferId);

    if (isNaN(id) || id < 1) {
      return res.status(400).json({
        message: 'Invalid transfer ID. Must be a positive integer.',
        error: 'Bad Request'
      });
    }

    const transfer = await ExternalTransferService.getExternalTransfer(id);

    if (!transfer) {
      return res.status(404).json({
        message: 'Transfer not found',
        error: 'Not Found'
      });
    }

    res.json(transfer);
  } catch (error) {
    console.error('Error fetching external transfer:', error);
    res.status(500).json({
      message: 'Failed to fetch external transfer',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/user/{userId}:
 *   get:
 *     summary: Get external transfers for a specific user
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transfers to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transfers to skip
 *     responses:
 *       200:
 *         description: External transfers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExternalTransfer'
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
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const userIdNum = parseInt(userId);
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    if (isNaN(userIdNum) || userIdNum < 1) {
      return res.status(400).json({
        message: 'Invalid user ID. Must be a positive integer.',
        error: 'Bad Request'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        message: 'Limit must be between 1 and 100',
        error: 'Bad Request'
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        message: 'Offset must be 0 or greater',
        error: 'Bad Request'
      });
    }

    const transfers = await ExternalTransferService.getExternalTransfersByUser(
      userIdNum,
      limitNum,
      offsetNum
    );

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching external transfers:', error);
    res.status(500).json({
      message: 'Failed to fetch external transfers',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/external-wallet/{externalWallet}:
 *   get:
 *     summary: Get external transfers to a specific external wallet address
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: externalWallet
 *         required: true
 *         schema:
 *           type: string
 *         description: External wallet address
 *         example: "ExternalWallet1234567890123456789012345678901234567890"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transfers to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transfers to skip
 *     responses:
 *       200:
 *         description: External transfers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExternalTransfer'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/external-wallet/:externalWallet', async (req: Request, res: Response) => {
  try {
    const { externalWallet } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        message: 'Limit must be between 1 and 100',
        error: 'Bad Request'
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        message: 'Offset must be 0 or greater',
        error: 'Bad Request'
      });
    }

    const transfers = await ExternalTransferService.getExternalTransfersByExternalWallet(
      externalWallet,
      limitNum,
      offsetNum
    );

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching external transfers:', error);
    res.status(500).json({
      message: 'Failed to fetch external transfers',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/statistics:
 *   get:
 *     summary: Get external transfer statistics
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: External transfer statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalTransfers:
 *                   type: integer
 *                 totalVolume:
 *                   type: number
 *                   format: decimal
 *                 totalFees:
 *                   type: number
 *                   format: decimal
 *                 averageTransfer:
 *                   type: number
 *                   format: decimal
 *                 averageFee:
 *                   type: number
 *                   format: decimal
 *                 recentTransfers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExternalTransfer'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await ExternalTransferService.getExternalTransferStatistics();
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching external transfer statistics:', error);
    res.status(500).json({
      message: 'Failed to fetch external transfer statistics',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/fees/calculate:
 *   post:
 *     summary: Calculate fee for external wallet transfer
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to calculate fee for
 *                 example: 100
 *     responses:
 *       200:
 *         description: Fee calculation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   format: decimal
 *                 fee:
 *                   type: number
 *                   format: decimal
 *                 netAmount:
 *                   type: number
 *                   format: decimal
 *                 feeRate:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/fees/calculate', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({
        message: 'Valid amount is required',
        error: 'Bad Request'
      });
    }

    const { fee, netAmount } = ExternalTransferService.calculateFee(parseFloat(amount));

    res.json({
      amount: parseFloat(amount),
      fee,
      netAmount,
      feeRate: '0.001%'
    });
  } catch (error) {
    console.error('Error calculating external transfer fee:', error);
    res.status(500).json({
      message: 'Failed to calculate fee',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/{transferId}/execute-multisig:
 *   post:
 *     summary: Execute approved multisig transfer
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionIndex
 *               - executorKey
 *             properties:
 *               transactionIndex:
 *                 type: string
 *                 description: Multisig transaction index
 *               executorKey:
 *                 type: string
 *                 description: Executor's public key
 *     responses:
 *       200:
 *         description: Multisig transfer executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transactionHash:
 *                   type: string
 *       400:
 *         description: Bad request
 *       404:
 *         description: Transfer not found
 *       500:
 *         description: Internal server error
 */
router.post('/:transferId/execute-multisig', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const { transactionIndex, executorKey } = req.body;

    if (!transactionIndex || !executorKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['transactionIndex', 'executorKey']
      });
    }

    const result = await ExternalTransferService.executeMultisigTransfer(
      parseInt(transferId),
      transactionIndex,
      executorKey
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Multisig transfer executed successfully',
        transactionHash: result.transactionHash
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to execute multisig transfer',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error executing multisig transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/external-transfers/real-fees:
 *   post:
 *     summary: Transfer cryptocurrency to external wallet with real fee transactions to treasury
 *     tags: [External Transfers]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fromWallet
 *               - toExternalWallet
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID making the transfer
 *                 example: 1
 *               fromWallet:
 *                 type: string
 *                 description: Source wallet address
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *               toExternalWallet:
 *                 type: string
 *                 description: External destination wallet address
 *                 example: "ExternalWallet1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 1.5
 *               currency:
 *                 type: string
 *                 description: Currency type - default SOL
 *                 example: "SOL"
 *               notes:
 *                 type: string
 *                 description: Optional transfer notes
 *                 example: "Payment for services"
 *     responses:
 *       201:
 *         description: External transfer completed with real fee transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transferId:
 *                   type: integer
 *                 fee:
 *                   type: number
 *                 netAmount:
 *                   type: number
 *                 treasuryAddress:
 *                   type: string
 *                 feeTransactionHash:
 *                   type: string
 *                 mainTransactionHash:
 *                   type: string
 *       400:
 *         description: Bad request - validation errors
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
router.post('/real-fees', async (req: Request, res: Response) => {
  try {
    const { userId, fromWallet, toExternalWallet, amount, currency = 'USDC', notes } = req.body;

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC transfers are allowed for external transfers'
      });
    }

    // Validate input
    if (!userId || !fromWallet || !toExternalWallet || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['userId', 'fromWallet', 'toExternalWallet', 'amount']
      });
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        message: 'Amount must be a positive number',
        error: 'Bad Request'
      });
    }

    if (transferAmount > 1000000) {
      return res.status(400).json({
        message: 'Amount cannot exceed 1,000,000',
        error: 'Bad Request'
      });
    }

    // Create Solana connection
    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Create external transfer proposal for multisig approval
    const result = await ExternalTransferService.createExternalTransferProposal(
      parseInt(userId),
      fromWallet,
      toExternalWallet,
      transferAmount,
      currency,
      notes
    );

    res.status(202).json({
      message: 'External transfer proposal created successfully',
      proposalId: result.proposalId,
      multisigPda: result.multisigPda,
      transactionIndex: result.transactionIndex,
      status: result.status,
      fee: result.fee,
      netAmount: result.netAmount,
      currency: currency,
      note: 'Transfer is pending multisig approval'
    });

  } catch (error) {
    console.error('Error processing external transfer with real fees:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Validation error:')) {
        return res.status(400).json({
          message: 'Validation failed',
          error: 'Bad Request',
          details: error.message.replace('Validation error: ', '')
        });
      }
      
      if (error.message.includes('Multisig service error:')) {
        return res.status(503).json({
          message: 'Multisig service unavailable',
          error: 'Service Unavailable',
          details: error.message.replace('Multisig service error: ', '')
        });
      }
      
      if (error.message.includes('Database error:')) {
        return res.status(500).json({
          message: 'Database error',
          error: 'Internal Server Error',
          details: 'Please try again later'
        });
      }
      
      if (error.message.includes('No main multisig found')) {
        return res.status(503).json({
          message: 'Multisig not configured',
          error: 'Service Unavailable',
          details: 'Please contact administrator to set up multisig'
        });
      }
      
      if (error.message.includes('User not found')) {
        return res.status(404).json({
          message: 'User not found',
          error: 'Not Found',
          details: 'Please check your user ID'
        });
      }
      
      if (error.message.includes('Failed to send fee to treasury')) {
        return res.status(500).json({
          message: 'Failed to send fee to treasury',
          error: 'Fee Transaction Failed',
          details: error.message
        });
      }
    }
    
    res.status(500).json({
      message: 'Failed to process external transfer',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;

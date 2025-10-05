import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import WalletTransferService from '../services/walletTransferService';
import { MultisigTransferService } from '../services/multisigTransferService';
import { OnDemandMultisigService } from '../services/onDemandMultisigService';
import { Connection } from '@solana/web3.js';

const router = Router();

/**
 * @swagger
 * /api/wallet-transfers:
 *   post:
 *     summary: Transfer cryptocurrency between wallet addresses
 *     tags: [Wallet Transfers]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromWallet
 *               - toWallet
 *               - amount
 *             properties:
 *               fromWallet:
 *                 type: string
 *                 description: Source wallet address
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *               toWallet:
 *                 type: string
 *                 description: Destination wallet address
 *                 example: "FeeWallet1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 1.5
 *               currency:
 *                 type: string
 *                 description: Currency type - only USDC allowed for wallet transfers
 *                 example: "USDC"
 *               notes:
 *                 type: string
 *                 description: Optional transfer notes
 *                 example: "Payment for services"
 *     responses:
 *       201:
 *         description: Wallet transfer completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transferId:
 *                   type: integer
 *                 fromWallet:
 *                   type: string
 *                 toWallet:
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { fromWallet, toWallet, amount, currency = 'USDC', notes, requestedBy } = req.body;

    // Validate input
    if (!fromWallet || !toWallet || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['fromWallet', 'toWallet', 'amount']
      });
    }

    // Validate currency - only USDC allowed for wallet transfers
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC transfers are allowed between wallet addresses'
      });
    }

    // Check if transfer requires multisig approval
    const requiresMultisigApproval = await MultisigTransferService.requiresMultisigApproval(
      fromWallet,
      toWallet
    );

    if (requiresMultisigApproval) {
      // If requestedBy is not provided, return error
      if (!requestedBy) {
        return res.status(400).json({
          message: 'Transfer requires multisig approval',
          error: 'Multisig Required',
          details: 'This transfer is between users and requires multisig approval. Please provide requestedBy field.',
          requiresMultisig: true,
          multisigEndpoint: '/api/multisig-transfers/propose'
        });
      }

      // Get the user ID from the fromWallet
      const fromUser = await prisma.user.findFirst({
        where: { solanaWallet: fromWallet },
        select: { id: true }
      });

      if (!fromUser) {
        return res.status(404).json({
          message: 'Source user not found',
          error: 'Not Found'
        });
      }

      // Ensure user has multisig (create on-demand if needed)
      try {
        const multisigResult = await OnDemandMultisigService.ensureUserMultisig(fromUser.id);
        
        if (multisigResult.isNewMultisig) {
          console.log(`🆕 Created new multisig for user ${fromUser.id} on first wallet transfer`);
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
          fromWallet,
          toWallet,
          amount: parseFloat(amount),
          currency,
          notes,
          requestedBy
        });

        return res.status(202).json({
          message: 'Transfer proposal created successfully',
          success: true,
          requiresMultisig: true,
          data: {
            proposalId: proposal.id,
            status: proposal.status,
            message: 'Transfer requires multisig approval before execution'
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
        message: 'Amount cannot exceed 1,000,000 USDC',
        error: 'Bad Request'
      });
    }

    // Validate wallet addresses
    const validation = WalletTransferService.validateWalletAddresses(fromWallet, toWallet);
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Invalid wallet addresses',
        error: 'Bad Request',
        errors: validation.errors
      });
    }

    // Process wallet transfer
    const result = await WalletTransferService.processWalletTransfer(
      fromWallet,
      toWallet,
      transferAmount,
      currency,
      notes
    );

    res.status(201).json({
      message: 'Wallet transfer completed successfully',
      transferId: result.transferId,
      fromWallet,
      toWallet,
      amount: transferAmount,
      fee: result.fee,
      netAmount: result.netAmount,
      feeWalletAddress: result.feeWalletAddress,
      transactionHash: result.transactionHash,
      currency
    });
  } catch (error) {
    console.error('Error processing wallet transfer:', error);
    res.status(500).json({
      message: 'Failed to process wallet transfer',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/wallet-transfers/{transferId}:
 *   get:
 *     summary: Get wallet transfer by ID
 *     tags: [Wallet Transfers]
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
 *         description: Wallet transfer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletTransfer'
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

    const transfer = await WalletTransferService.getWalletTransfer(id);

    if (!transfer) {
      return res.status(404).json({
        message: 'Transfer not found',
        error: 'Not Found'
      });
    }

    res.json(transfer);
  } catch (error) {
    console.error('Error fetching wallet transfer:', error);
    res.status(500).json({
      message: 'Failed to fetch wallet transfer',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/wallet-transfers/wallet/{walletAddress}:
 *   get:
 *     summary: Get wallet transfers for a specific wallet address
 *     tags: [Wallet Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address
 *         example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
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
 *         description: Wallet transfers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WalletTransfer'
 *       400:
 *         description: Invalid wallet address
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
router.get('/wallet/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
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

    const transfers = await WalletTransferService.getWalletTransfersByAddress(
      walletAddress,
      limitNum,
      offsetNum
    );

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching wallet transfers:', error);
    res.status(500).json({
      message: 'Failed to fetch wallet transfers',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/wallet-transfers/statistics:
 *   get:
 *     summary: Get wallet transfer statistics
 *     tags: [Wallet Transfers]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Wallet transfer statistics retrieved successfully
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
 *                     $ref: '#/components/schemas/WalletTransfer'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await WalletTransferService.getWalletTransferStatistics();
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching wallet transfer statistics:', error);
    res.status(500).json({
      message: 'Failed to fetch wallet transfer statistics',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/wallet-transfers/fees/calculate:
 *   post:
 *     summary: Calculate fee for wallet-to-wallet transfer
 *     tags: [Wallet Transfers]
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

    const { fee, netAmount } = WalletTransferService.calculateFee(parseFloat(amount));

    res.json({
      amount: parseFloat(amount),
      fee,
      netAmount,
      feeRate: '0.001%'
    });
  } catch (error) {
    console.error('Error calculating wallet transfer fee:', error);
    res.status(500).json({
      message: 'Failed to calculate fee',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/wallet-transfers/real-fees:
 *   post:
 *     summary: Transfer cryptocurrency with real fee transactions to treasury
 *     tags: [Wallet Transfers]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromWallet
 *               - toWallet
 *               - amount
 *             properties:
 *               fromWallet:
 *                 type: string
 *                 description: Source wallet address
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *               toWallet:
 *                 type: string
 *                 description: Destination wallet address
 *                 example: "FeeWallet1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 1.5
 *               currency:
 *                 type: string
 *                 description: Currency type - only USDC allowed for wallet transfers
 *                 example: "USDC"
 *               notes:
 *                 type: string
 *                 description: Optional transfer notes
 *                 example: "Payment for services"
 *     responses:
 *       201:
 *         description: Wallet transfer completed with real fee transaction
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
    const { fromWallet, toWallet, amount, currency = 'USDC', notes } = req.body;

    // Validate input
    if (!fromWallet || !toWallet || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['fromWallet', 'toWallet', 'amount']
      });
    }

    // Validate currency - only USDC allowed for wallet transfers
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC transfers are allowed between wallet addresses'
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
        message: 'Amount cannot exceed 1,000,000 USDC',
        error: 'Bad Request'
      });
    }

    // Create Solana connection
    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Create wallet transfer proposal for multisig approval
    const result = await WalletTransferService.createWalletTransferProposal(
      fromWallet,
      toWallet,
      transferAmount,
      currency,
      notes
    );

    res.status(202).json({
      message: 'Wallet transfer proposal created successfully',
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
    console.error('Error processing wallet transfer with real fees:', error);
    
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
      
      if (error.message.includes('Failed to send fee to treasury')) {
        return res.status(500).json({
          message: 'Failed to send fee to treasury',
          error: 'Fee Transaction Failed',
          details: error.message
        });
      }
    }
    
    res.status(500).json({
      message: 'Failed to process wallet transfer',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;

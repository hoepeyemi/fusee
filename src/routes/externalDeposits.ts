import { Router, Request, Response } from 'express';
import { ExternalDepositService } from '../services/externalDepositService';
import { verifyCSRFToken } from '../middleware/csrf';

const router = Router();

/**
 * @swagger
 * /api/external-deposits:
 *   post:
 *     summary: Process external wallet deposit
 *     tags: [External Deposits]
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
 *               - fromExternalWallet
 *               - amount
 *               - transactionHash
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *                 example: 1
 *               fromExternalWallet:
 *                 type: string
 *                 description: External wallet address sending funds
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to deposit
 *                 example: 100.50
 *               currency:
 *                 type: string
 *                 description: Currency type - USDC only
 *                 example: "USDC"
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *                 example: "5J7X8K9L2M3N4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P"
 *               notes:
 *                 type: string
 *                 description: Optional deposit notes
 *                 example: "Deposit from external wallet"
 *     responses:
 *       201:
 *         description: External deposit processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 depositId:
 *                   type: integer
 *                 vaultAddress:
 *                   type: string
 *                 newBalance:
 *                   type: number
 *                 transactionHash:
 *                   type: string
 *       400:
 *         description: Bad request - validation errors
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const { userId, fromExternalWallet, amount, currency = 'USDC', transactionHash, notes } = req.body;

    // Validate required fields
    if (!userId || !fromExternalWallet || !amount || !transactionHash) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['userId', 'fromExternalWallet', 'amount', 'transactionHash']
      });
    }

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC deposits are supported'
      });
    }

    const result = await ExternalDepositService.processExternalDeposit({
      userId,
      fromExternalWallet,
      amount: parseFloat(amount),
      currency,
      transactionHash,
      notes
    });

    res.status(201).json({
      message: 'External deposit processed successfully',
      ...result
    });

  } catch (error) {
    console.error('Error processing external deposit:', error);
    res.status(500).json({
      message: 'Failed to process external deposit',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/external-deposits/user/{userId}:
 *   get:
 *     summary: Get external deposits for a user
 *     tags: [External Deposits]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of deposits to return
 *     responses:
 *       200:
 *         description: External deposits retrieved successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;

    if (isNaN(userId)) {
      return res.status(400).json({
        message: 'Invalid user ID',
        error: 'Bad Request'
      });
    }

    const deposits = await ExternalDepositService.getUserExternalDeposits(userId, limit);

    res.json({
      message: 'External deposits retrieved successfully',
      deposits,
      count: deposits.length
    });

  } catch (error) {
    console.error('Error retrieving external deposits:', error);
    res.status(500).json({
      message: 'Failed to retrieve external deposits',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/external-deposits/all:
 *   get:
 *     summary: Get all external deposits
 *     tags: [External Deposits]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of deposits to return
 *     responses:
 *       200:
 *         description: External deposits retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/all', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const deposits = await ExternalDepositService.getAllExternalDeposits(limit);

    res.json({
      message: 'External deposits retrieved successfully',
      deposits,
      count: deposits.length
    });

  } catch (error) {
    console.error('Error retrieving external deposits:', error);
    res.status(500).json({
      message: 'Failed to retrieve external deposits',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/external-deposits/stats:
 *   get:
 *     summary: Get external deposit statistics
 *     tags: [External Deposits]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: External deposit statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDeposits:
 *                   type: integer
 *                 totalAmount:
 *                   type: number
 *                 totalUsers:
 *                   type: integer
 *                 currency:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get('/stats', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const stats = await ExternalDepositService.getExternalDepositStats();

    res.json({
      message: 'External deposit statistics retrieved successfully',
      ...stats
    });

  } catch (error) {
    console.error('Error retrieving external deposit statistics:', error);
    res.status(500).json({
      message: 'Failed to retrieve external deposit statistics',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

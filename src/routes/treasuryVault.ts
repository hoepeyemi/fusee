import { Router, Request, Response } from 'express';
import { RealFeeTransactionService } from '../services/realFeeTransactionService';
import { Connection } from '@solana/web3.js';

const router = Router();

/**
 * @swagger
 * /api/treasury-vault/balance:
 *   get:
 *     summary: Get treasury vault balance
 *     tags: [Treasury Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Treasury vault balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   type: string
 *                 totalBalance:
 *                   type: number
 *                 feeBalance:
 *                   type: number
 *                 currency:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/balance', async (req: Request, res: Response) => {
  try {
    // Create Solana connection
    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Initialize real fee transaction service
    RealFeeTransactionService.initialize(connection);

    // Get treasury vault balance
    const balance = await RealFeeTransactionService.getTreasuryBalance();

    res.json({
      address: balance.address,
      totalBalance: balance.totalBalance,
      feeBalance: balance.feeBalance,
      currency: balance.currency
    });

  } catch (error) {
    console.error('Error getting treasury vault balance:', error);
    res.status(500).json({
      message: 'Failed to get treasury vault balance',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/treasury-vault/fee-history:
 *   get:
 *     summary: Get fee transaction history
 *     tags: [Treasury Vault]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to return
 *     responses:
 *       200:
 *         description: Fee transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       fromWallet:
 *                         type: string
 *                       toTreasury:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       transactionHash:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/fee-history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get fee transaction history
    const history = await RealFeeTransactionService.getFeeTransactionHistory(limit);

    res.json({
      transactions: history,
      count: history.length
    });

  } catch (error) {
    console.error('Error getting fee transaction history:', error);
    res.status(500).json({
      message: 'Failed to get fee transaction history',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

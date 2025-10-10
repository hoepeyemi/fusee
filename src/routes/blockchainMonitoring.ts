import { Router, Request, Response } from 'express';
import { Connection } from '@solana/web3.js';
import { BlockchainMonitorService } from '../services/blockchainMonitorService';
import { BackgroundDepositMonitor } from '../services/backgroundDepositMonitor';
import { verifyCSRFToken } from '../middleware/csrf';

const router = Router();

// Initialize connection (you might want to move this to a config file)
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// Initialize services
BlockchainMonitorService.initialize(connection);
BackgroundDepositMonitor.initialize(connection);

/**
 * @swagger
 * /api/blockchain-monitoring/start:
 *   post:
 *     summary: Start background blockchain monitoring
 *     tags: [Blockchain Monitoring]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Background monitoring started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.post('/start', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    BackgroundDepositMonitor.start();
    const status = BackgroundDepositMonitor.getStatus();

    res.json({
      message: 'Background blockchain monitoring started successfully',
      status
    });

  } catch (error) {
    console.error('Error starting background monitoring:', error);
    res.status(500).json({
      message: 'Failed to start background monitoring',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/blockchain-monitoring/stop:
 *   post:
 *     summary: Stop background blockchain monitoring
 *     tags: [Blockchain Monitoring]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Background monitoring stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.post('/stop', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    BackgroundDepositMonitor.stop();
    const status = BackgroundDepositMonitor.getStatus();

    res.json({
      message: 'Background blockchain monitoring stopped successfully',
      status
    });

  } catch (error) {
    console.error('Error stopping background monitoring:', error);
    res.status(500).json({
      message: 'Failed to stop background monitoring',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/blockchain-monitoring/status:
 *   get:
 *     summary: Get background monitoring status
 *     tags: [Blockchain Monitoring]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Monitoring status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: object
 *                 stats:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.get('/status', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const stats = await BackgroundDepositMonitor.getStats();

    res.json({
      message: 'Monitoring status retrieved successfully',
      ...stats
    });

  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({
      message: 'Failed to get monitoring status',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/blockchain-monitoring/force-run:
 *   post:
 *     summary: Force run blockchain monitoring cycle
 *     tags: [Blockchain Monitoring]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Monitoring cycle completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 success:
 *                   type: boolean
 *                 depositsFound:
 *                   type: integer
 *                 depositsProcessed:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Internal server error
 */
router.post('/force-run', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const result = await BackgroundDepositMonitor.forceRun();

    res.json({
      message: 'Monitoring cycle completed',
      ...result
    });

  } catch (error) {
    console.error('Error in force run:', error);
    res.status(500).json({
      message: 'Failed to run monitoring cycle',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/blockchain-monitoring/check-wallet/{walletAddress}:
 *   get:
 *     summary: Check specific wallet for deposits
 *     tags: [Blockchain Monitoring]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address to check
 *         example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *     responses:
 *       200:
 *         description: Wallet deposits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deposits:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       400:
 *         description: Bad request - invalid wallet address
 *       500:
 *         description: Internal server error
 */
router.get('/check-wallet/:walletAddress', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address format
    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({
        message: 'Invalid wallet address',
        error: 'Bad Request'
      });
    }

    // Find user for this wallet
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const user = await prisma.user.findFirst({
      where: {
        solanaWallet: walletAddress
      },
      select: {
        id: true,
        firstName: true,
        email: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'No user found for this wallet address',
        error: 'Not Found'
      });
    }

    // Check for deposits
    const deposits = await BlockchainMonitorService.detectDepositsForWallet(walletAddress, user.id);

    res.json({
      message: 'Wallet deposits retrieved successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        email: user.email
      },
      deposits,
      count: deposits.length
    });

  } catch (error) {
    console.error('Error checking wallet deposits:', error);
    res.status(500).json({
      message: 'Failed to check wallet deposits',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/blockchain-monitoring/process-deposits:
 *   post:
 *     summary: Process detected deposits and create database records
 *     tags: [Blockchain Monitoring]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Wallet address to process deposits for
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *     responses:
 *       200:
 *         description: Deposits processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 depositsFound:
 *                   type: integer
 *                 depositsProcessed:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Bad request - invalid wallet address
 *       500:
 *         description: Internal server error
 */
router.post('/process-deposits', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        message: 'Wallet address is required',
        error: 'Bad Request'
      });
    }

    // Find user for this wallet
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const user = await prisma.user.findFirst({
      where: {
        solanaWallet: walletAddress
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'No user found for this wallet address',
        error: 'Not Found'
      });
    }

    // Detect deposits
    const deposits = await BlockchainMonitorService.detectDepositsForWallet(walletAddress, user.id);

    // Process deposits
    const processResult = await BlockchainMonitorService.processDetectedDeposits(deposits);

    res.json({
      message: 'Deposits processed successfully',
      depositsFound: deposits.length,
      depositsProcessed: processResult.processed,
      errors: processResult.errors
    });

  } catch (error) {
    console.error('Error processing deposits:', error);
    res.status(500).json({
      message: 'Failed to process deposits',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;




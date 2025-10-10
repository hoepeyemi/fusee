import { Router, Request, Response } from 'express';
import { TreasuryDepositService } from '../services/treasuryDepositService';
import { verifyCSRFToken } from '../middleware/csrf';

const router = Router();

/**
 * @swagger
 * /api/treasury-deposits:
 *   post:
 *     summary: Process treasury deposit
 *     tags: [Treasury Deposits]
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
 *               - amount
 *               - transactionHash
 *               - depositType
 *             properties:
 *               fromWallet:
 *                 type: string
 *                 description: Source wallet address
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to deposit
 *                 example: 10.0
 *               currency:
 *                 type: string
 *                 description: Currency type - USDC only
 *                 example: "USDC"
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *                 example: "5J7X8K9L2M3N4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P"
 *               depositType:
 *                 type: string
 *                 enum: [MULTISIG_FUNDING, TREASURY_FUNDING, AIRDROP, EXTERNAL_FUNDING]
 *                 description: Type of treasury deposit
 *                 example: "MULTISIG_FUNDING"
 *               notes:
 *                 type: string
 *                 description: Optional deposit notes
 *                 example: "Multisig member funding"
 *               memberPublicKey:
 *                 type: string
 *                 description: Member public key (for multisig funding)
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *     responses:
 *       201:
 *         description: Treasury deposit processed successfully
 *       400:
 *         description: Bad request - validation errors
 *       500:
 *         description: Internal server error
 */
router.post('/', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const { fromWallet, amount, currency = 'USDC', transactionHash, depositType, notes, memberPublicKey } = req.body;

    // Validate required fields
    if (!fromWallet || !amount || !transactionHash || !depositType) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['fromWallet', 'amount', 'transactionHash', 'depositType']
      });
    }

    // Validate deposit type
    const validTypes = ['MULTISIG_FUNDING', 'TREASURY_FUNDING', 'AIRDROP', 'EXTERNAL_FUNDING'];
    if (!validTypes.includes(depositType)) {
      return res.status(400).json({
        message: 'Invalid deposit type',
        error: 'Bad Request',
        validTypes
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

    const result = await TreasuryDepositService.processTreasuryDeposit({
      fromWallet,
      amount: parseFloat(amount),
      currency,
      transactionHash,
      depositType,
      notes,
      memberPublicKey
    });

    res.status(201).json({
      message: 'Treasury deposit processed successfully',
      ...result
    });

  } catch (error) {
    console.error('Error processing treasury deposit:', error);
    res.status(500).json({
      message: 'Failed to process treasury deposit',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/treasury-deposits/multisig-funding:
 *   post:
 *     summary: Process multisig member funding deposit
 *     tags: [Treasury Deposits]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberPublicKey
 *               - amount
 *               - transactionHash
 *             properties:
 *               memberPublicKey:
 *                 type: string
 *                 description: Member public key
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to deposit
 *                 example: 5.0
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *                 example: "5J7X8K9L2M3N4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P"
 *               notes:
 *                 type: string
 *                 description: Optional deposit notes
 *                 example: "Member funding for multisig creation"
 *     responses:
 *       201:
 *         description: Multisig funding deposit processed successfully
 *       400:
 *         description: Bad request - validation errors
 *       500:
 *         description: Internal server error
 */
router.post('/multisig-funding', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const { memberPublicKey, amount, transactionHash, notes } = req.body;

    // Validate required fields
    if (!memberPublicKey || !amount || !transactionHash) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['memberPublicKey', 'amount', 'transactionHash']
      });
    }

    const result = await TreasuryDepositService.processMultisigMemberFunding(
      memberPublicKey,
      parseFloat(amount),
      transactionHash,
      notes
    );

    res.status(201).json({
      message: 'Multisig funding deposit processed successfully',
      ...result
    });

  } catch (error) {
    console.error('Error processing multisig funding deposit:', error);
    res.status(500).json({
      message: 'Failed to process multisig funding deposit',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/treasury-deposits/airdrop:
 *   post:
 *     summary: Process airdrop deposit
 *     tags: [Treasury Deposits]
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
 *               - transactionHash
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to deposit
 *                 example: 2.0
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *                 example: "5J7X8K9L2M3N4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P"
 *               notes:
 *                 type: string
 *                 description: Optional deposit notes
 *                 example: "SOL airdrop for multisig creation"
 *     responses:
 *       201:
 *         description: Airdrop deposit processed successfully
 *       400:
 *         description: Bad request - validation errors
 *       500:
 *         description: Internal server error
 */
router.post('/airdrop', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const { amount, transactionHash, notes } = req.body;

    // Validate required fields
    if (!amount || !transactionHash) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['amount', 'transactionHash']
      });
    }

    const result = await TreasuryDepositService.processAirdropDeposit(
      parseFloat(amount),
      transactionHash,
      notes
    );

    res.status(201).json({
      message: 'Airdrop deposit processed successfully',
      ...result
    });

  } catch (error) {
    console.error('Error processing airdrop deposit:', error);
    res.status(500).json({
      message: 'Failed to process airdrop deposit',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/treasury-deposits/all:
 *   get:
 *     summary: Get all treasury deposits
 *     tags: [Treasury Deposits]
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
 *         description: Treasury deposits retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/all', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const deposits = await TreasuryDepositService.getAllTreasuryDeposits(limit);

    res.json({
      message: 'Treasury deposits retrieved successfully',
      deposits,
      count: deposits.length
    });

  } catch (error) {
    console.error('Error retrieving treasury deposits:', error);
    res.status(500).json({
      message: 'Failed to retrieve treasury deposits',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/treasury-deposits/stats:
 *   get:
 *     summary: Get treasury deposit statistics
 *     tags: [Treasury Deposits]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Treasury deposit statistics retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/stats', verifyCSRFToken, async (req: Request, res: Response) => {
  try {
    const stats = await TreasuryDepositService.getTreasuryDepositStats();

    res.json({
      message: 'Treasury deposit statistics retrieved successfully',
      ...stats
    });

  } catch (error) {
    console.error('Error retrieving treasury deposit statistics:', error);
    res.status(500).json({
      message: 'Failed to retrieve treasury deposit statistics',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

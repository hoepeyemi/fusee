import { Router, Request, Response } from 'express';
import { YieldInvestmentService } from '../services/yieldInvestmentService';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     YieldInvestment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *         owner:
 *           type: string
 *         type:
 *           type: string
 *           enum: [PROTECTED, REGULAR, BOTH, PROTECTED_WITHDRAWAL, REGULAR_WITHDRAWAL_INIT, REGULAR_WITHDRAWAL_COMPLETE, REFERRER_INIT]
 *         amount:
 *           type: number
 *         regularAmount:
 *           type: number
 *         protectedAmount:
 *           type: number
 *         status:
 *           type: string
 *           enum: [PENDING, PENDING_APPROVAL, COMPLETED, FAILED, CANCELLED]
 *         transactionHash:
 *           type: string
 *         luloAccount:
 *           type: string
 *         referrerAccount:
 *           type: string
 *         proposalId:
 *           type: integer
 *         notes:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/yield-investments/initialize-referrer:
 *   post:
 *     summary: Initialize referrer account for yield investments
 *     tags: [Yield Investments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - owner
 *               - feePayer
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *                 example: 1
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *                 example: "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB"
 *               feePayer:
 *                 type: string
 *                 description: Fee payer wallet address
 *                 example: "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB"
 *               priorityFee:
 *                 type: string
 *                 description: Priority fee in lamports
 *                 example: "50000"
 *     responses:
 *       200:
 *         description: Referrer initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transaction:
 *                   type: string
 *                 referrerAccount:
 *                   type: string
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
router.post('/initialize-referrer', async (req: Request, res: Response) => {
  try {
    const { userId, owner, feePayer, priorityFee } = req.body;

    // Validate input
    if (!userId || !owner || !feePayer) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['userId', 'owner', 'feePayer']
      });
    }

    const result = await YieldInvestmentService.initializeReferrer(
      userId,
      owner,
      feePayer,
      priorityFee
    );

    res.json({
      message: 'Referrer initialized successfully',
      transaction: result.transaction,
      referrerAccount: result.referrerAccount
    });

  } catch (error) {
    console.error('Error initializing referrer:', error);
    res.status(500).json({
      message: 'Failed to initialize referrer',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/yield-investments/deposit:
 *   post:
 *     summary: Create yield investment (deposit)
 *     tags: [Yield Investments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - owner
 *               - feePayer
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *                 example: 1
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *                 example: "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB"
 *               feePayer:
 *                 type: string
 *                 description: Fee payer wallet address
 *                 example: "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB"
 *               mintAddress:
 *                 type: string
 *                 description: Mint address (defaults to USDC)
 *                 example: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *               regularAmount:
 *                 type: number
 *                 description: Regular (boosted) amount to deposit
 *                 example: 100
 *               protectedAmount:
 *                 type: number
 *                 description: Protected amount to deposit
 *                 example: 100
 *               referrer:
 *                 type: string
 *                 description: Optional referrer wallet address
 *                 example: "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb"
 *               priorityFee:
 *                 type: string
 *                 description: Priority fee in lamports
 *                 example: "50000"
 *     responses:
 *       200:
 *         description: Yield investment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 transactionHash:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 type:
 *                   type: string
 *                 status:
 *                   type: string
 *                 luloAccount:
 *                   type: string
 *                 referrerAccount:
 *                   type: string
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
router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { userId, owner, feePayer, mintAddress, regularAmount, protectedAmount, referrer, priorityFee } = req.body;

    // Validate input
    if (!userId || !owner || !feePayer) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['userId', 'owner', 'feePayer']
      });
    }

    if (!regularAmount && !protectedAmount) {
      return res.status(400).json({
        message: 'Either regular amount or protected amount must be specified',
        error: 'Bad Request'
      });
    }

    const result = await YieldInvestmentService.createYieldInvestment({
      userId,
      owner,
      feePayer,
      mintAddress,
      regularAmount,
      protectedAmount,
      referrer,
      priorityFee
    });

    res.json({
      message: 'Yield investment created successfully',
      investmentId: result.investmentId,
      transactionHash: result.transactionHash,
      amount: result.amount,
      type: result.type,
      status: result.status,
      luloAccount: result.luloAccount,
      referrerAccount: result.referrerAccount
    });

  } catch (error) {
    console.error('Error creating yield investment:', error);
    res.status(500).json({
      message: 'Failed to create yield investment',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/yield-investments/withdraw-protected:
 *   post:
 *     summary: Withdraw protected amount
 *     tags: [Yield Investments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - owner
 *               - feePayer
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *                 example: 1
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *                 example: "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB"
 *               feePayer:
 *                 type: string
 *                 description: Fee payer wallet address
 *                 example: "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB"
 *               mintAddress:
 *                 type: string
 *                 description: Mint address (defaults to USDC)
 *                 example: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *               amount:
 *                 type: number
 *                 description: Amount to withdraw
 *                 example: 100
 *               priorityFee:
 *                 type: string
 *                 description: Priority fee in lamports
 *                 example: "50000"
 *     responses:
 *       200:
 *         description: Protected withdrawal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 transactionHash:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 status:
 *                   type: string
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
router.post('/withdraw-protected', async (req: Request, res: Response) => {
  try {
    const { userId, owner, feePayer, mintAddress, amount, priorityFee } = req.body;

    // Validate input
    if (!userId || !owner || !feePayer || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        required: ['userId', 'owner', 'feePayer', 'amount']
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        message: 'Amount must be greater than 0',
        error: 'Bad Request'
      });
    }

    const result = await YieldInvestmentService.withdrawProtected({
      userId,
      owner,
      feePayer,
      mintAddress,
      amount,
      priorityFee
    });

    res.json({
      message: 'Protected withdrawal created successfully',
      investmentId: result.investmentId,
      transactionHash: result.transactionHash,
      amount: result.amount,
      status: result.status
    });

  } catch (error) {
    console.error('Error withdrawing protected amount:', error);
    res.status(500).json({
      message: 'Failed to withdraw protected amount',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/yield-investments/pools:
 *   get:
 *     summary: Get pool information from Lulo
 *     tags: [Yield Investments]
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Optional owner wallet address
 *     responses:
 *       200:
 *         description: Pool data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 poolData:
 *                   type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/pools', async (req: Request, res: Response) => {
  try {
    const { owner } = req.query;

    const poolData = await YieldInvestmentService.getPoolData(owner as string);

    res.json({
      message: 'Pool data retrieved successfully',
      poolData
    });

  } catch (error) {
    console.error('Error getting pool data:', error);
    res.status(500).json({
      message: 'Failed to get pool data',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/yield-investments/rates:
 *   get:
 *     summary: Get current rates from Lulo
 *     tags: [Yield Investments]
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         description: Optional owner wallet address
 *     responses:
 *       200:
 *         description: Rates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 rates:
 *                   type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/rates', async (req: Request, res: Response) => {
  try {
    const { owner } = req.query;

    const rates = await YieldInvestmentService.getRates(owner as string);

    res.json({
      message: 'Rates retrieved successfully',
      rates
    });

  } catch (error) {
    console.error('Error getting rates:', error);
    res.status(500).json({
      message: 'Failed to get rates',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/yield-investments/user/{userId}:
 *   get:
 *     summary: Get user's yield investments
 *     tags: [Yield Investments]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User yield investments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/YieldInvestment'
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
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        message: 'Invalid user ID',
        error: 'Bad Request'
      });
    }

    const investments = await YieldInvestmentService.getUserYieldInvestments(userIdNum);

    res.json({
      message: 'User yield investments retrieved successfully',
      investments
    });

  } catch (error) {
    console.error('Error getting user yield investments:', error);
    res.status(500).json({
      message: 'Failed to get user yield investments',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/yield-investments/{investmentId}/status:
 *   put:
 *     summary: Update investment status
 *     tags: [Yield Investments]
 *     parameters:
 *       - in: path
 *         name: investmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Investment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, PENDING_APPROVAL, COMPLETED, FAILED, CANCELLED]
 *               transactionHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Investment status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
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
router.put('/:investmentId/status', async (req: Request, res: Response) => {
  try {
    const { investmentId } = req.params;
    const { status, transactionHash } = req.body;
    const investmentIdNum = parseInt(investmentId);

    if (isNaN(investmentIdNum)) {
      return res.status(400).json({
        message: 'Invalid investment ID',
        error: 'Bad Request'
      });
    }

    if (!status) {
      return res.status(400).json({
        message: 'Status is required',
        error: 'Bad Request'
      });
    }

    // Validate status enum
    const validStatuses = ['PENDING', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        error: 'Bad Request',
        details: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    await YieldInvestmentService.updateInvestmentStatus(
      investmentIdNum, 
      status as 'PENDING' | 'PENDING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
      transactionHash
    );

    res.json({
      message: 'Investment status updated successfully'
    });

  } catch (error) {
    console.error('Error updating investment status:', error);
    res.status(500).json({
      message: 'Failed to update investment status',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


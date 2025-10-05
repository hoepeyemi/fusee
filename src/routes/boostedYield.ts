import { Router, Request, Response } from 'express';
import { BoostedYieldService } from '../services/boostedYieldService';

const router = Router();
const boostedYieldService = BoostedYieldService.getInstance();

/**
 * @swagger
 * components:
 *   schemas:
 *     BoostedYieldInvestment:
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
 *     LuloAccountData:
 *       type: object
 *       properties:
 *         owner:
 *           type: string
 *         luloAccount:
 *           type: string
 *         luloAccountExists:
 *           type: boolean
 *         referrerAccount:
 *           type: string
 *         referrerAccountExists:
 *           type: boolean
 *         referredAmount:
 *           type: number
 *         protectedReferredAmount:
 *           type: number
 *         regularReferredAmount:
 *           type: number
 *         referralFeeUnclaimed:
 *           type: number
 *         netReferralFeesUnclaimed:
 *           type: number
 *         referralFee:
 *           type: number
 *         claimFee:
 *           type: number
 *         numReferrals:
 *           type: integer
 *         code:
 *           type: string
 *     LuloPoolData:
 *       type: object
 *       properties:
 *         regular:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *             apy:
 *               type: number
 *             maxWithdrawalAmount:
 *               type: number
 *             price:
 *               type: number
 *         protected:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *             apy:
 *               type: number
 *             openCapacity:
 *               type: number
 *             price:
 *               type: number
 *         averagePoolRate:
 *           type: number
 *         totalLiquidity:
 *           type: number
 *         availableLiquidity:
 *           type: number
 *         regularLiquidityAmount:
 *           type: number
 *         protectedLiquidityAmount:
 *           type: number
 *         regularAvailableAmount:
 *           type: number
 *     LuloRates:
 *       type: object
 *       properties:
 *         regular:
 *           type: object
 *           properties:
 *             CURRENT:
 *               type: number
 *             "1HR":
 *               type: number
 *             "1YR":
 *               type: number
 *             "24HR":
 *               type: number
 *             "30DAY":
 *               type: number
 *             "7DAY":
 *               type: number
 *         protected:
 *           type: object
 *           properties:
 *             CURRENT:
 *               type: number
 *             "1HR":
 *               type: number
 *             "1YR":
 *               type: number
 *             "24HR":
 *               type: number
 *             "30DAY":
 *               type: number
 *             "7DAY":
 *               type: number
 *     LuloPendingWithdrawal:
 *       type: object
 *       properties:
 *         owner:
 *           type: string
 *         withdrawalId:
 *           type: integer
 *         nativeAmount:
 *           type: string
 *         createdTimestamp:
 *           type: integer
 *         cooldownSeconds:
 *           type: string
 *         mintAddress:
 *           type: string
 */

/**
 * @swagger
 * /api/boosted-yield/initialize-referrer:
 *   post:
 *     summary: Initialize referrer account for boosted yield
 *     tags: [Boosted Yield]
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
 *               - owner
 *               - feePayer
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *               feePayer:
 *                 type: string
 *                 description: Fee payer wallet address
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       202:
 *         description: Referrer initialization proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 proposalId:
 *                   type: integer
 *                 multisigPda:
 *                   type: string
 *                 status:
 *                   type: string
 *                 note:
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
    const { userId, owner, feePayer, notes } = req.body;

    // Validate required fields
    if (!userId || !owner || !feePayer) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        details: 'userId, owner, and feePayer are required'
      });
    }

    const result = await boostedYieldService.initializeReferrer(
      parseInt(userId),
      owner,
      feePayer,
      notes
    );

    res.status(202).json({
      message: 'Referrer initialization proposal created successfully',
      investmentId: result.investmentId,
      proposalId: result.proposalId,
      multisigPda: result.multisigPda,
      status: 'PENDING_APPROVAL',
      note: 'Referrer initialization is pending multisig approval'
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
 * /api/boosted-yield/deposit:
 *   post:
 *     summary: Create boosted yield deposit investment
 *     tags: [Boosted Yield]
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
 *               - owner
 *               - type
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *               type:
 *                 type: string
 *                 enum: [PROTECTED, REGULAR, BOTH]
 *                 description: Investment type
 *               amount:
 *                 type: number
 *                 description: Total amount to invest
 *               regularAmount:
 *                 type: number
 *                 description: Regular (boosted) amount (for BOTH type)
 *               protectedAmount:
 *                 type: number
 *                 description: Protected amount (for BOTH type)
 *               referrer:
 *                 type: string
 *                 description: Optional referrer wallet address
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       202:
 *         description: Investment proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 proposalId:
 *                   type: integer
 *                 multisigPda:
 *                   type: string
 *                 status:
 *                   type: string
 *                 note:
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
    const { userId, owner, type, amount, regularAmount, protectedAmount, referrer, notes } = req.body;

    // Validate required fields
    if (!userId || !owner || !type || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        details: 'userId, owner, type, and amount are required'
      });
    }

    // Validate investment type
    if (!['PROTECTED', 'REGULAR', 'BOTH'].includes(type)) {
      return res.status(400).json({
        message: 'Invalid investment type',
        error: 'Bad Request',
        details: 'Type must be PROTECTED, REGULAR, or BOTH'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        message: 'Invalid amount',
        error: 'Bad Request',
        details: 'Amount must be greater than 0'
      });
    }

    const result = await boostedYieldService.createInvestment({
      userId: parseInt(userId),
      owner,
      type,
      amount,
      regularAmount,
      protectedAmount,
      referrer,
      notes
    });

    res.status(202).json({
      message: 'Boosted yield investment proposal created successfully',
      investmentId: result.investmentId,
      proposalId: result.proposalId,
      multisigPda: result.multisigPda,
      status: 'PENDING_APPROVAL',
      note: 'Investment is pending multisig approval'
    });
  } catch (error) {
    console.error('Error creating boosted yield investment:', error);
    res.status(500).json({
      message: 'Failed to create boosted yield investment',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/withdraw-protected:
 *   post:
 *     summary: Create protected withdrawal
 *     tags: [Boosted Yield]
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
 *               - owner
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *               amount:
 *                 type: number
 *                 description: Amount to withdraw
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       202:
 *         description: Protected withdrawal proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 proposalId:
 *                   type: integer
 *                 multisigPda:
 *                   type: string
 *                 status:
 *                   type: string
 *                 note:
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
    const { userId, owner, amount, notes } = req.body;

    // Validate required fields
    if (!userId || !owner || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        details: 'userId, owner, and amount are required'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        message: 'Invalid amount',
        error: 'Bad Request',
        details: 'Amount must be greater than 0'
      });
    }

    const result = await boostedYieldService.createWithdrawal({
      userId: parseInt(userId),
      owner,
      type: 'PROTECTED_WITHDRAWAL',
      amount,
      notes
    });

    res.status(202).json({
      message: 'Protected withdrawal proposal created successfully',
      investmentId: result.investmentId,
      proposalId: result.proposalId,
      multisigPda: result.multisigPda,
      status: 'PENDING_APPROVAL',
      note: 'Withdrawal is pending multisig approval'
    });
  } catch (error) {
    console.error('Error creating protected withdrawal:', error);
    res.status(500).json({
      message: 'Failed to create protected withdrawal',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/initiate-regular-withdrawal:
 *   post:
 *     summary: Initiate regular (boosted) withdrawal
 *     tags: [Boosted Yield]
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
 *               - owner
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *               amount:
 *                 type: number
 *                 description: Amount to withdraw
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       202:
 *         description: Regular withdrawal initiation proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 proposalId:
 *                   type: integer
 *                 multisigPda:
 *                   type: string
 *                 status:
 *                   type: string
 *                 note:
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
router.post('/initiate-regular-withdrawal', async (req: Request, res: Response) => {
  try {
    const { userId, owner, amount, notes } = req.body;

    // Validate required fields
    if (!userId || !owner || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        details: 'userId, owner, and amount are required'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        message: 'Invalid amount',
        error: 'Bad Request',
        details: 'Amount must be greater than 0'
      });
    }

    const result = await boostedYieldService.createWithdrawal({
      userId: parseInt(userId),
      owner,
      type: 'REGULAR_WITHDRAWAL_INIT',
      amount,
      notes
    });

    res.status(202).json({
      message: 'Regular withdrawal initiation proposal created successfully',
      investmentId: result.investmentId,
      proposalId: result.proposalId,
      multisigPda: result.multisigPda,
      status: 'PENDING_APPROVAL',
      note: 'Withdrawal initiation is pending multisig approval'
    });
  } catch (error) {
    console.error('Error initiating regular withdrawal:', error);
    res.status(500).json({
      message: 'Failed to initiate regular withdrawal',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/complete-regular-withdrawal:
 *   post:
 *     summary: Complete regular (boosted) withdrawal
 *     tags: [Boosted Yield]
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
 *               - owner
 *               - pendingWithdrawalId
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               owner:
 *                 type: string
 *                 description: Owner wallet address
 *               pendingWithdrawalId:
 *                 type: integer
 *                 description: Pending withdrawal ID from Lulo
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       202:
 *         description: Regular withdrawal completion proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 investmentId:
 *                   type: integer
 *                 proposalId:
 *                   type: integer
 *                 multisigPda:
 *                   type: string
 *                 status:
 *                   type: string
 *                 note:
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
router.post('/complete-regular-withdrawal', async (req: Request, res: Response) => {
  try {
    const { userId, owner, pendingWithdrawalId, notes } = req.body;

    // Validate required fields
    if (!userId || !owner || !pendingWithdrawalId) {
      return res.status(400).json({
        message: 'Missing required fields',
        error: 'Bad Request',
        details: 'userId, owner, and pendingWithdrawalId are required'
      });
    }

    // Validate pending withdrawal ID
    if (pendingWithdrawalId <= 0) {
      return res.status(400).json({
        message: 'Invalid pending withdrawal ID',
        error: 'Bad Request',
        details: 'pendingWithdrawalId must be greater than 0'
      });
    }

    const result = await boostedYieldService.createWithdrawal({
      userId: parseInt(userId),
      owner,
      type: 'REGULAR_WITHDRAWAL_COMPLETE',
      amount: 0, // Amount not needed for completion
      pendingWithdrawalId: parseInt(pendingWithdrawalId),
      notes
    });

    res.status(202).json({
      message: 'Regular withdrawal completion proposal created successfully',
      investmentId: result.investmentId,
      proposalId: result.proposalId,
      multisigPda: result.multisigPda,
      status: 'PENDING_APPROVAL',
      note: 'Withdrawal completion is pending multisig approval'
    });
  } catch (error) {
    console.error('Error completing regular withdrawal:', error);
    res.status(500).json({
      message: 'Failed to complete regular withdrawal',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/account/{owner}:
 *   get:
 *     summary: Get Lulo account data
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Owner wallet address
 *     responses:
 *       200:
 *         description: Account data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/LuloAccountData'
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
router.get('/account/:owner', async (req: Request, res: Response) => {
  try {
    const { owner } = req.params;

    if (!owner) {
      return res.status(400).json({
        message: 'Owner address is required',
        error: 'Bad Request',
        details: 'Owner wallet address must be provided'
      });
    }

    const accountData = await boostedYieldService.getAccountData(owner);

    res.json({
      message: 'Account data retrieved successfully',
      data: accountData
    });
  } catch (error) {
    console.error('Error fetching account data:', error);
    res.status(500).json({
      message: 'Failed to fetch account data',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/pools:
 *   get:
 *     summary: Get Lulo pool data
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
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
 *                 data:
 *                   $ref: '#/components/schemas/LuloPoolData'
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

    const poolData = await boostedYieldService.getPoolData(owner as string);

    res.json({
      message: 'Pool data retrieved successfully',
      data: poolData
    });
  } catch (error) {
    console.error('Error fetching pool data:', error);
    res.status(500).json({
      message: 'Failed to fetch pool data',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/rates:
 *   get:
 *     summary: Get current Lulo rates
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
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
 *                 data:
 *                   $ref: '#/components/schemas/LuloRates'
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

    const rates = await boostedYieldService.getRates(owner as string);

    res.json({
      message: 'Rates retrieved successfully',
      data: rates
    });
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({
      message: 'Failed to fetch rates',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/pending-withdrawals/{owner}:
 *   get:
 *     summary: Get pending withdrawals for an owner
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Owner wallet address
 *     responses:
 *       200:
 *         description: Pending withdrawals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     pendingWithdrawals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LuloPendingWithdrawal'
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
router.get('/pending-withdrawals/:owner', async (req: Request, res: Response) => {
  try {
    const { owner } = req.params;

    if (!owner) {
      return res.status(400).json({
        message: 'Owner address is required',
        error: 'Bad Request',
        details: 'Owner wallet address must be provided'
      });
    }

    const pendingWithdrawals = await boostedYieldService.getPendingWithdrawals(owner);

    res.json({
      message: 'Pending withdrawals retrieved successfully',
      data: pendingWithdrawals
    });
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    res.status(500).json({
      message: 'Failed to fetch pending withdrawals',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/user/{userId}:
 *   get:
 *     summary: Get user's yield investments
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User investments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BoostedYieldInvestment'
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
        error: 'Bad Request',
        details: 'User ID must be a valid integer'
      });
    }

    const investments = await boostedYieldService.getUserInvestments(userIdNum);

    res.json({
      message: 'User investments retrieved successfully',
      data: investments
    });
  } catch (error) {
    console.error('Error fetching user investments:', error);
    res.status(500).json({
      message: 'Failed to fetch user investments',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/investment/{investmentId}:
 *   get:
 *     summary: Get investment by ID
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: investmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Investment ID
 *     responses:
 *       200:
 *         description: Investment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/BoostedYieldInvestment'
 *       404:
 *         description: Investment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.get('/investment/:investmentId', async (req: Request, res: Response) => {
  try {
    const { investmentId } = req.params;
    const investmentIdNum = parseInt(investmentId);

    if (isNaN(investmentIdNum)) {
      return res.status(400).json({
        message: 'Invalid investment ID',
        error: 'Bad Request',
        details: 'Investment ID must be a valid integer'
      });
    }

    const investment = await boostedYieldService.getInvestmentById(investmentIdNum);

    if (!investment) {
      return res.status(404).json({
        message: 'Investment not found',
        error: 'Not Found',
        details: `Investment with ID ${investmentIdNum} does not exist`
      });
    }

    res.json({
      message: 'Investment retrieved successfully',
      data: investment
    });
  } catch (error) {
    console.error('Error fetching investment:', error);
    res.status(500).json({
      message: 'Failed to fetch investment',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/boosted-yield/investment/{investmentId}/status:
 *   put:
 *     summary: Update investment status
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
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
 *                 description: New status
 *               transactionHash:
 *                 type: string
 *                 description: Optional transaction hash
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
router.put('/investment/:investmentId/status', async (req: Request, res: Response) => {
  try {
    const { investmentId } = req.params;
    const { status, transactionHash } = req.body;
    const investmentIdNum = parseInt(investmentId);

    if (isNaN(investmentIdNum)) {
      return res.status(400).json({
        message: 'Invalid investment ID',
        error: 'Bad Request',
        details: 'Investment ID must be a valid integer'
      });
    }

    if (!status || !['PENDING', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        error: 'Bad Request',
        details: 'Status must be one of: PENDING, PENDING_APPROVAL, COMPLETED, FAILED, CANCELLED'
      });
    }

    await boostedYieldService.updateInvestmentStatus(
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

/**
 * @swagger
 * /api/boosted-yield/config/status:
 *   get:
 *     summary: Get Lulo API configuration status
 *     tags: [Boosted Yield]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Configuration status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     isConfigured:
 *                       type: boolean
 *                     hasApiKey:
 *                       type: boolean
 *                     baseUrl:
 *                       type: string
 *                     error:
 *                       type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/config/status', async (req: Request, res: Response) => {
  try {
    const configStatus = boostedYieldService.getLuloConfigStatus();

    res.json({
      message: 'Configuration status retrieved successfully',
      data: configStatus
    });
  } catch (error) {
    console.error('Error fetching configuration status:', error);
    res.status(500).json({
      message: 'Failed to fetch configuration status',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

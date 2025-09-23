import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { getMultisigService } from '../services/multisigService';
import { Keypair } from '@solana/web3.js';

const router = Router();

/**
 * @swagger
 * /api/multisig/create:
 *   post:
 *     summary: Create a new multisig account
 *     tags: [Multisig]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - threshold
 *               - members
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the multisig
 *               threshold:
 *                 type: integer
 *                 description: Number of approvals required
 *               timeLock:
 *                 type: integer
 *                 description: Time lock in seconds
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     publicKey:
 *                       type: string
 *                       description: Member's public key
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [propose, vote, execute, all]
 *                       description: Member's permissions
 *     responses:
 *       201:
 *         description: Multisig created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     multisigPda:
 *                       type: string
 *                     createKey:
 *                       type: string
 *                     transaction:
 *                       type: object
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/create', [
  body('name').notEmpty().withMessage('Name is required'),
  body('threshold').isInt({ min: 1 }).withMessage('Threshold must be at least 1'),
  body('timeLock').optional().isInt({ min: 0 }).withMessage('Time lock must be non-negative'),
  body('members').isArray({ min: 1 }).withMessage('At least one member is required'),
  body('members.*.publicKey').notEmpty().withMessage('Member public key is required'),
  body('members.*.permissions').isArray({ min: 1 }).withMessage('Member permissions are required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, threshold, timeLock = 0, members } = req.body;

    // Generate a new creator keypair for this multisig
    const creator = Keypair.generate();

    const multisigService = getMultisigService();
    
    // Update service config
    multisigService['threshold'] = threshold;
    multisigService['timeLock'] = timeLock;
    multisigService['members'] = members;

    const result = await multisigService.createMultisig(creator);

    // Save to database
    const savedMultisig = await multisigService.saveMultisigToDatabase(
      result.multisigPda,
      result.createKey,
      name
    );

    res.status(201).json({
      success: true,
      message: 'Multisig created successfully',
      data: {
        multisigPda: result.multisigPda,
        createKey: result.createKey,
        transactionSignature: result.transactionSignature,
        multisigId: savedMultisig.id,
      },
    });
  } catch (error) {
    console.error('Error creating multisig:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create multisig',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}:
 *   get:
 *     summary: Get multisig information
 *     tags: [Multisig]
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
 *     responses:
 *       200:
 *         description: Multisig information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Multisig not found
 *       500:
 *         description: Internal server error
 */
router.get('/:multisigPda', async (req: Request, res: Response) => {
  try {
    const { multisigPda } = req.params;

    const multisigService = getMultisigService();
    const multisigData = await multisigService.getMultisigFromDatabase(multisigPda);

    if (!multisigData) {
      return res.status(404).json({
        success: false,
        message: 'Multisig not found',
      });
    }

    res.json({
      success: true,
      data: multisigData,
    });
  } catch (error) {
    console.error('Error getting multisig:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get multisig information',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}/transactions:
 *   post:
 *     summary: Create a vault transaction for external transfer
 *     tags: [Multisig]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
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
 *               toWallet:
 *                 type: string
 *                 description: Destination wallet address
 *               amount:
 *                 type: number
 *                 description: Transfer amount in SOL
 *               currency:
 *                 type: string
 *                 default: SOL
 *                 description: Currency type
 *               memo:
 *                 type: string
 *                 description: Transaction memo
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionIndex:
 *                       type: string
 *                     instruction:
 *                       type: object
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/:multisigPda/transactions', [
  body('fromWallet').notEmpty().withMessage('From wallet is required'),
  body('toWallet').notEmpty().withMessage('To wallet is required'),
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('currency').optional().isString().withMessage('Currency must be string'),
  body('memo').optional().isString().withMessage('Memo must be string'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { multisigPda } = req.params;
    const { fromWallet, toWallet, amount, currency = 'SOL', memo } = req.body;

    // Get multisig from database
    const multisigData = await prisma.multisig.findUnique({
      where: { multisigPda },
    });

    if (!multisigData) {
      return res.status(404).json({
        success: false,
        message: 'Multisig not found',
      });
    }

    const multisigService = getMultisigService();
    const result = await multisigService.createVaultTransaction(
      fromWallet,
      toWallet,
      amount,
      memo
    );

    // Save transaction to database
    const savedTransaction = await multisigService.saveTransactionToDatabase(
      multisigData.id,
      result.transactionIndex,
      fromWallet,
      toWallet,
      amount,
      currency,
      memo
    );

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        transactionIndex: result.transactionIndex.toString(),
        instruction: result.instruction,
        transactionId: savedTransaction.id,
      },
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}/proposals:
 *   post:
 *     summary: Create a proposal for a transaction
 *     tags: [Multisig]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionIndex
 *               - proposerKey
 *             properties:
 *               transactionIndex:
 *                 type: string
 *                 description: Transaction index
 *               proposerKey:
 *                 type: string
 *                 description: Proposer's public key
 *     responses:
 *       201:
 *         description: Proposal created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/:multisigPda/proposals', [
  body('transactionIndex').notEmpty().withMessage('Transaction index is required'),
  body('proposerKey').notEmpty().withMessage('Proposer key is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { multisigPda } = req.params;
    const { transactionIndex, proposerKey } = req.body;

    const multisigService = getMultisigService();
    const instruction = await multisigService.createProposal(
      BigInt(transactionIndex),
      proposerKey
    );

    // Get transaction from database
    const transaction = await prisma.multisigTransaction.findFirst({
      where: {
        multisig: { multisigPda },
        transactionIndex: BigInt(transactionIndex),
      },
    });

    if (transaction) {
      await multisigService.saveProposalToDatabase(transaction.id, proposerKey);
    }

    res.status(201).json({
      success: true,
      message: 'Proposal created successfully',
      data: {
        instruction,
      },
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create proposal',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}/approve:
 *   post:
 *     summary: Approve a proposal
 *     tags: [Multisig]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionIndex
 *               - memberKey
 *             properties:
 *               transactionIndex:
 *                 type: string
 *                 description: Transaction index
 *               memberKey:
 *                 type: string
 *                 description: Member's public key
 *     responses:
 *       200:
 *         description: Proposal approved successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/:multisigPda/approve', [
  body('transactionIndex').notEmpty().withMessage('Transaction index is required'),
  body('memberKey').notEmpty().withMessage('Member key is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { multisigPda } = req.params;
    const { transactionIndex, memberKey } = req.body;

    const multisigService = getMultisigService();
    const instruction = await multisigService.approveProposal(
      BigInt(transactionIndex),
      memberKey
    );

    // Get member and transaction from database
    const member = await prisma.multisigMember.findFirst({
      where: {
        multisig: { multisigPda },
        publicKey: memberKey,
      },
    });

    const transaction = await prisma.multisigTransaction.findFirst({
      where: {
        multisig: { multisigPda },
        transactionIndex: BigInt(transactionIndex),
      },
    });

    if (member && transaction) {
      await multisigService.saveApprovalToDatabase(transaction.id, member.id, 'APPROVE');
    }

    res.json({
      success: true,
      message: 'Proposal approved successfully',
      data: {
        instruction,
      },
    });
  } catch (error) {
    console.error('Error approving proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve proposal',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}/reject:
 *   post:
 *     summary: Reject a proposal
 *     tags: [Multisig]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionIndex
 *               - memberKey
 *             properties:
 *               transactionIndex:
 *                 type: string
 *                 description: Transaction index
 *               memberKey:
 *                 type: string
 *                 description: Member's public key
 *     responses:
 *       200:
 *         description: Proposal rejected successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/:multisigPda/reject', [
  body('transactionIndex').notEmpty().withMessage('Transaction index is required'),
  body('memberKey').notEmpty().withMessage('Member key is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { multisigPda } = req.params;
    const { transactionIndex, memberKey } = req.body;

    const multisigService = getMultisigService();
    const instruction = await multisigService.rejectProposal(
      BigInt(transactionIndex),
      memberKey
    );

    // Get member and transaction from database
    const member = await prisma.multisigMember.findFirst({
      where: {
        multisig: { multisigPda },
        publicKey: memberKey,
      },
    });

    const transaction = await prisma.multisigTransaction.findFirst({
      where: {
        multisig: { multisigPda },
        transactionIndex: BigInt(transactionIndex),
      },
    });

    if (member && transaction) {
      await multisigService.saveApprovalToDatabase(transaction.id, member.id, 'REJECT');
    }

    res.json({
      success: true,
      message: 'Proposal rejected successfully',
      data: {
        instruction,
      },
    });
  } catch (error) {
    console.error('Error rejecting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject proposal',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}/execute:
 *   post:
 *     summary: Execute a vault transaction
 *     tags: [Multisig]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
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
 *                 description: Transaction index
 *               executorKey:
 *                 type: string
 *                 description: Executor's public key
 *     responses:
 *       200:
 *         description: Transaction executed successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/:multisigPda/execute', [
  body('transactionIndex').notEmpty().withMessage('Transaction index is required'),
  body('executorKey').notEmpty().withMessage('Executor key is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { multisigPda } = req.params;
    const { transactionIndex, executorKey } = req.body;

    const multisigService = getMultisigService();
    const instruction = await multisigService.executeVaultTransaction(
      BigInt(transactionIndex),
      executorKey
    );

    // Update transaction status
    await multisigService.updateTransactionStatus(BigInt(transactionIndex), 'EXECUTED');

    res.json({
      success: true,
      message: 'Transaction executed successfully',
      data: {
        instruction,
      },
    });
  } catch (error) {
    console.error('Error executing transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute transaction',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/multisig/{multisigPda}/status/{transactionIndex}:
 *   get:
 *     summary: Get transaction status
 *     tags: [Multisig]
 *     parameters:
 *       - in: path
 *         name: multisigPda
 *         required: true
 *         schema:
 *           type: string
 *         description: Multisig PDA address
 *       - in: path
 *         name: transactionIndex
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction index
 *     responses:
 *       200:
 *         description: Transaction status retrieved successfully
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.get('/:multisigPda/status/:transactionIndex', async (req: Request, res: Response) => {
  try {
    const { multisigPda, transactionIndex } = req.params;

    const transaction = await prisma.multisigTransaction.findFirst({
      where: {
        multisig: { multisigPda },
        transactionIndex: BigInt(transactionIndex),
      },
      include: {
        proposals: true,
        approvals: {
          include: {
            member: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    const multisigService = getMultisigService();
    const isApproved = await multisigService.isTransactionApproved(BigInt(transactionIndex));

    res.json({
      success: true,
      data: {
        transaction,
        isApproved,
      },
    });
  } catch (error) {
    console.error('Error getting transaction status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

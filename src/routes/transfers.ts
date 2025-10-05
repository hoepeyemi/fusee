import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateTransfer, handleValidationErrors } from '../middleware/security';
import { FirstNameTransferService } from '../services/firstNameTransferService';

const router = Router();

/**
 * @swagger
 * /api/transfers:
 *   post:
 *     summary: Send cryptocurrency to another user by first name
 *     tags: [Transfers]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senderId
 *               - receiverFirstName
 *               - amount
 *             properties:
 *               senderId:
 *                 type: integer
 *                 description: ID of the sender
 *                 example: 1
 *               receiverFirstName:
 *                 type: string
 *                 description: First name of the receiver
 *                 example: "John"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 0.5
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
 *         description: Transfer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transfer'
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Receiver not found
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
router.post('/', validateTransfer, async (req: Request, res: Response) => {
  try {
    const { senderId, receiverFirstName, amount, currency = 'SOL', notes } = req.body;

    // Process first name transfer (internal balance transfer)
    const result = await FirstNameTransferService.processFirstNameTransfer({
      senderId,
      receiverFirstName,
      amount: parseFloat(amount),
      currency,
      notes
    });

    res.status(201).json({
      message: 'Internal transfer completed successfully',
      transfer: {
        id: result.transferId,
        senderId: result.senderId,
        receiverId: result.receiverId,
        amount: result.amount,
        fee: result.fee,
        netAmount: result.netAmount,
        currency: result.currency,
        status: result.status,
        transactionHash: result.transactionHash,
        notes: notes
      },
      balances: {
        sender: {
          firstName: result.senderFirstName,
          balance: result.senderBalance
        },
        receiver: {
          firstName: result.receiverFirstName,
          balance: result.receiverBalance
        }
      },
      fee: {
        amount: result.fee,
        rate: '0.001%',
        netAmount: result.netAmount
      },
      note: 'This is an internal balance transfer, not a real Solana transaction'
    });
  } catch (error) {
    console.error('Error creating transfer:', error);
    
    if (error.message.includes('not found') || error.message.includes('No user found')) {
      return res.status(404).json({
        message: error.message,
        error: 'Not Found'
      });
    }
    
    if (error.message.includes('Insufficient balance')) {
      return res.status(400).json({
        message: error.message,
        error: 'Bad Request'
      });
    }
    
    res.status(500).json({
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/transfers/balance/{userId}:
 *   get:
 *     summary: Get user's current balance
 *     tags: [Transfers]
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
 *     responses:
 *       200:
 *         description: User balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                 balance:
 *                   type: number
 *                   format: decimal
 *                 currency:
 *                   type: string
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
router.get('/balance/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        message: 'Invalid user ID',
        error: 'Bad Request'
      });
    }

    const balance = await FirstNameTransferService.getUserBalance(userIdNum);

    res.json({
      userId: userIdNum,
      balance: balance,
      currency: 'SOL'
    });
  } catch (error) {
    console.error('Error getting user balance:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        message: error.message,
        error: 'Not Found'
      });
    }
    
    res.status(500).json({
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/transfers/history/{userId}:
 *   get:
 *     summary: Get user's transfer history
 *     tags: [Transfers]
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
 *     responses:
 *       200:
 *         description: Transfer history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transfers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       amount:
 *                         type: number
 *                       fee:
 *                         type: number
 *                       netAmount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       status:
 *                         type: string
 *                       transactionHash:
 *                         type: string
 *                       sender:
 *                         type: object
 *                         properties:
 *                           firstName:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                       receiver:
 *                         type: object
 *                         properties:
 *                           firstName:
 *                             type: string
 *                           fullName:
 *                             type: string
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
router.get('/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        message: 'Invalid user ID',
        error: 'Bad Request'
      });
    }

    const transfers = await FirstNameTransferService.getUserTransferHistory(userIdNum);

    res.json({
      userId: userIdNum,
      transfers: transfers,
      count: transfers.length
    });
  } catch (error) {
    console.error('Error getting transfer history:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        message: error.message,
        error: 'Not Found'
      });
    }
    
    res.status(500).json({
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/transfers/validate:
 *   post:
 *     summary: Validate if user can make a transfer
 *     tags: [Transfers]
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
 *               - amount
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *                 example: 1
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 5.0
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canTransfer:
 *                   type: boolean
 *                 currentBalance:
 *                   type: number
 *                 requiredAmount:
 *                   type: number
 *                 shortfall:
 *                   type: number
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
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        message: 'Missing required fields: userId, amount',
        error: 'Bad Request'
      });
    }

    const validation = await FirstNameTransferService.validateTransfer(
      parseInt(userId),
      parseFloat(amount)
    );

    res.json(validation);
  } catch (error) {
    console.error('Error validating transfer:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        message: error.message,
        error: 'Not Found'
      });
    }
    
    res.status(500).json({
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/transfers/sender/{senderId}:
 *   get:
 *     summary: Get all transfers sent by a user
 *     tags: [Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: senderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Sender ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Transfers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transfers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transfer'
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
router.get('/sender/:senderId', async (req: Request, res: Response) => {
  try {
    const { senderId } = req.params;
    const userId = parseInt(senderId);

    if (isNaN(userId)) {
      return res.status(400).json({
        message: 'Invalid sender ID. Must be a number.',
        error: 'Bad Request'
      });
    }

    const transfers = await prisma.transfer.findMany({
      where: { senderId: userId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            solanaWallet: true
          }
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            solanaWallet: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ transfers });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({
      message: 'Failed to fetch transfers',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/transfers/receiver/{receiverId}:
 *   get:
 *     summary: Get all transfers received by a user
 *     tags: [Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: receiverId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Receiver ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Transfers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transfers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transfer'
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
router.get('/receiver/:receiverId', async (req: Request, res: Response) => {
  try {
    const { receiverId } = req.params;
    const userId = parseInt(receiverId);

    if (isNaN(userId)) {
      return res.status(400).json({
        message: 'Invalid receiver ID. Must be a number.',
        error: 'Bad Request'
      });
    }

    const transfers = await prisma.transfer.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            solanaWallet: true
          }
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            solanaWallet: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ transfers });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({
      message: 'Failed to fetch transfers',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/transfers/wallets:
 *   get:
 *     summary: Get all active wallet addresses by first name
 *     tags: [Transfers]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Wallets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Wallet'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/wallets', async (req: Request, res: Response) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { isActive: true },
      orderBy: { firstName: 'asc' }
    });

    res.json({ wallets });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({
      message: 'Failed to fetch wallets',
      error: 'Internal Server Error'
    });
  }
});

export default router;

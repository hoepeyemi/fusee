import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateTransfer, handleValidationErrors } from '../middleware/security';

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
router.post('/', validateTransfer, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { senderId, receiverFirstName, amount, currency = 'SOL', notes } = req.body;

    // Find sender
    const sender = await prisma.user.findUnique({
      where: { id: senderId }
    });

    if (!sender) {
      return res.status(404).json({
        message: 'Sender not found',
        error: 'Not Found'
      });
    }

    // Find receiver by first name
    const receiver = await prisma.user.findFirst({
      where: { 
        firstName: receiverFirstName,
        id: { not: senderId } // Can't send to yourself
      }
    });

    if (!receiver) {
      return res.status(404).json({
        message: `No user found with first name "${receiverFirstName}"`,
        error: 'Not Found'
      });
    }

    // Create transfer record
    const transfer = await prisma.transfer.create({
      data: {
        senderId,
        receiverId: receiver.id,
        amount: parseFloat(amount),
        currency,
        notes,
        status: 'PENDING'
      },
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
      }
    });

    // In a real implementation, you would integrate with a blockchain service here
    // For now, we'll simulate a successful transfer
    const simulatedTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    
    // Update transfer with simulated transaction hash and mark as completed
    const completedTransfer = await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        transactionHash: simulatedTransactionHash,
        status: 'COMPLETED'
      },
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
      }
    });

    res.status(201).json({
      message: 'Transfer completed successfully',
      transfer: completedTransfer
    });
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      message: 'Failed to create transfer',
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

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateUser, handleValidationErrors } from '../middleware/security';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user with Solana wallet
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - fullName
 *               - solanaWallet
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address
 *                 example: "john.doe@example.com"
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Doe"
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number (optional)
 *                 example: "+1234567890"
 *               solanaWallet:
 *                 type: string
 *                 description: Valid Solana wallet address
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       409:
 *         description: Conflict - email or wallet already exists
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
router.post(
  '/',
  validateUser,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { email, fullName, phoneNumber, solanaWallet } = req.body;

      // Check if email or wallet already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { solanaWallet: solanaWallet as any }],
        },
      });

      if (existingUser) {
        const conflictField =
          existingUser.email === email ? 'email' : 'Solana wallet';
        return res.status(409).json({
          message: `User with this ${conflictField} already exists`,
          error: 'Conflict',
        });
      }

      // Extract first name from full name
      const firstName = fullName.split(' ')[0];

      const user = await prisma.user.create({
        data: {
          email,
          fullName: fullName as any,
          firstName: firstName as any,
          phoneNumber,
          solanaWallet: solanaWallet as any,
        },
      });

      // Create or update wallet mapping
      await prisma.wallet.upsert({
        where: { firstName: firstName as any },
        update: {
          address: solanaWallet as any,
          isActive: true,
        },
        create: {
          firstName: firstName as any,
          address: solanaWallet as any,
          isActive: true,
        },
      });

      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        message: 'Failed to create user',
        error: 'Internal Server Error',
      });
    }
  }
);

/**
 * @swagger
 * /api/users/find:
 *   get:
 *     summary: Find user by email
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid email
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
router.get('/find', async (req: Request, res: Response) => {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      message: 'Email query parameter is required and must be a string.',
      error: 'Bad Request',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found',
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error finding user by email:', error);
    res.status(500).json({
      message: 'Failed to find user',
      error: 'Internal Server Error',
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid user ID
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    const userId = parseInt(id);
    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        message: 'Invalid user ID. Must be a positive integer.',
        error: 'Bad Request',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found',
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      message: 'Failed to fetch user',
      error: 'Internal Server Error',
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user and all associated data
 *     tags: [Users]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User deleted successfully"
 *                 deletedUser:
 *                   $ref: '#/components/schemas/User'
 *                 deletedData:
 *                   type: object
 *                   properties:
 *                     wallet:
 *                       type: object
 *                       description: "Deleted wallet mapping"
 *                     transfers:
 *                       type: integer
 *                       description: "Number of transfers deleted"
 *                     deposits:
 *                       type: integer
 *                       description: "Number of deposits deleted"
 *                     withdrawals:
 *                       type: integer
 *                       description: "Number of withdrawals deleted"
 *                     externalTransfers:
 *                       type: integer
 *                       description: "Number of external transfers deleted"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid user ID
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    const userId = parseInt(id);
    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        message: 'Invalid user ID. Must be a positive integer.',
        error: 'Bad Request',
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sentTransfers: true,
        receivedTransfers: true,
        deposits: true,
        withdrawals: true,
        externalTransfers: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found',
      });
    }

    // Start a transaction to delete all related data
    const result = await prisma.$transaction(async (tx) => {
      // Delete related data in order (respecting foreign key constraints)

      // 1. Delete external transfers
      const deletedExternalTransfers = await tx.externalTransfer.deleteMany({
        where: { userId: userId },
      });

      // 2. Delete external fees
      await tx.externalFee.deleteMany({
        where: { externalTransfer: { userId: userId } },
      });

      // 3. Delete wallet transfers (as sender)
      const deletedWalletTransfers = await tx.walletTransfer.deleteMany({
        where: { fromWallet: user.solanaWallet },
      });

      // 4. Delete wallet fees
      await tx.walletFee.deleteMany({
        where: {
          OR: [
            { walletTransfer: { fromWallet: user.solanaWallet } },
            { walletTransfer: { toWallet: user.solanaWallet } },
          ],
        },
      });

      // 5. Delete transfers (as sender)
      const deletedSentTransfers = await tx.transfer.deleteMany({
        where: { senderId: userId },
      });

      // 6. Delete transfers (as receiver)
      const deletedReceivedTransfers = await tx.transfer.deleteMany({
        where: { receiverId: userId },
      });

      // 7. Delete fees
      await tx.fee.deleteMany({
        where: {
          OR: [
            { transfer: { senderId: userId } },
            { transfer: { receiverId: userId } },
          ],
        },
      });

      // 8. Delete deposits
      const deletedDeposits = await tx.deposit.deleteMany({
        where: { userId: userId },
      });

      // 9. Delete withdrawals
      const deletedWithdrawals = await tx.withdrawal.deleteMany({
        where: { userId: userId },
      });

      // 10. Delete wallet mapping
      const deletedWallet = await tx.wallet.deleteMany({
        where: { firstName: user.firstName },
      });

      // 11. Finally, delete the user
      const deletedUser = await tx.user.delete({
        where: { id: userId },
      });

      return {
        deletedUser,
        deletedData: {
          wallet:
            deletedWallet.count > 0
              ? { firstName: user.firstName, address: user.solanaWallet }
              : null,
          transfers:
            deletedSentTransfers.count + deletedReceivedTransfers.count,
          deposits: deletedDeposits.count,
          withdrawals: deletedWithdrawals.count,
          externalTransfers: deletedExternalTransfers.count,
          walletTransfers: deletedWalletTransfers.count,
        },
      };
    });

    res.json({
      message: 'User deleted successfully',
      deletedUser: result.deletedUser,
      deletedData: result.deletedData,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      message: 'Failed to delete user',
      error: 'Internal Server Error',
    });
  }
});

export default router;

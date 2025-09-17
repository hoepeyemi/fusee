import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateDeposit, validateWithdrawal, handleValidationErrors } from '../middleware/security';
import DedicatedWalletService from '../services/dedicatedWallet';

const router = Router();

/**
 * @swagger
 * /api/vault/balance/{userId}:
 *   get:
 *     summary: Get user's vault balance
 *     tags: [Vault]
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
        message: 'Invalid user ID. Must be a number.',
        error: 'Bad Request'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        balance: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    res.json({
      userId: user.id,
      fullName: user.fullName,
      firstName: user.firstName,
      balance: user.balance,
      currency: 'SOL'
    });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    res.status(500).json({
      message: 'Failed to fetch user balance',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/deposit:
 *   post:
 *     summary: Deposit cryptocurrency to vault
 *     tags: [Vault]
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
 *                 description: Amount to deposit
 *                 example: 1.5
 *               currency:
 *                 type: string
 *                 description: Currency type - default SOL
 *                 example: "SOL"
 *               notes:
 *                 type: string
 *                 description: Optional deposit notes
 *                 example: "Initial deposit"
 *     responses:
 *       201:
 *         description: Deposit created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Deposit'
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.post('/deposit', validateDeposit, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { userId, amount, currency = 'SOL', notes } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    // Get or create vault using dedicated wallet service
    const dedicatedWallet = DedicatedWalletService.getInstance();
    const vault = await dedicatedWallet.getOrCreateVault(currency);

    // Create deposit record
    const deposit = await prisma.deposit.create({
      data: {
        userId,
        vaultId: vault.id,
        amount: parseFloat(amount),
        currency,
        notes,
        status: 'PENDING'
      }
    });

    // Simulate successful deposit and update balances
    const simulatedTransactionHash = `DEPOSIT_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;
    
    // Update deposit status
    const completedDeposit = await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        transactionHash: simulatedTransactionHash,
        status: 'COMPLETED'
      }
    });

    // Update user balance
    await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: parseFloat(amount)
        }
      }
    });

    // Update vault balance
    await prisma.vault.update({
      where: { id: vault.id },
      data: {
        totalBalance: {
          increment: parseFloat(amount)
        }
      }
    });

    res.status(201).json({
      message: 'Deposit completed successfully',
      deposit: completedDeposit,
      newBalance: Number(user.balance) + parseFloat(amount)
    });
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({
      message: 'Failed to create deposit',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/withdraw:
 *   post:
 *     summary: Withdraw cryptocurrency from vault
 *     tags: [Vault]
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
 *                 description: Amount to withdraw
 *                 example: 0.5
 *               currency:
 *                 type: string
 *                 description: Currency type - default SOL
 *                 example: "SOL"
 *               notes:
 *                 type: string
 *                 description: Optional withdrawal notes
 *                 example: "Withdrawal to external wallet"
 *     responses:
 *       201:
 *         description: Withdrawal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Withdrawal'
 *       400:
 *         description: Bad request - validation errors or insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.post('/withdraw', validateWithdrawal, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { userId, amount, currency = 'SOL', notes } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    // Check if user has sufficient balance
    if (Number(user.balance) < parseFloat(amount)) {
      return res.status(400).json({
        message: 'Insufficient balance',
        error: 'Bad Request',
        currentBalance: Number(user.balance),
        requestedAmount: parseFloat(amount)
      });
    }

    // Get vault using dedicated wallet service
    const dedicatedWallet = DedicatedWalletService.getInstance();
    const vault = await dedicatedWallet.getOrCreateVault(currency);

    // Create withdrawal record
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        vaultId: vault.id,
        amount: parseFloat(amount),
        currency,
        notes,
        status: 'PENDING'
      }
    });

    // Simulate successful withdrawal and update balances
    const simulatedTransactionHash = `WITHDRAWAL_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;
    
    // Update withdrawal status
    const completedWithdrawal = await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        transactionHash: simulatedTransactionHash,
        status: 'COMPLETED'
      }
    });

    // Update user balance
    await prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          decrement: parseFloat(amount)
        }
      }
    });

    // Update vault balance
    await prisma.vault.update({
      where: { id: vault.id },
      data: {
        totalBalance: {
          decrement: parseFloat(amount)
        }
      }
    });

    res.status(201).json({
      message: 'Withdrawal completed successfully',
      withdrawal: completedWithdrawal,
      newBalance: Number(user.balance) - parseFloat(amount)
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({
      message: 'Failed to create withdrawal',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/status:
 *   get:
 *     summary: Get vault status and total balance
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Vault status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vaults:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vault'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const dedicatedWallet = DedicatedWalletService.getInstance();
    const status = await dedicatedWallet.getVaultStatus();

    res.json(status);
  } catch (error) {
    console.error('Error fetching vault status:', error);
    res.status(500).json({
      message: 'Failed to fetch vault status',
      error: 'Internal Server Error'
    });
  }
});


/**
 * @swagger
 * /api/vault/wallet/address:
 *   get:
 *     summary: Get current dedicated wallet address (read-only)
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Dedicated wallet address retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dedicatedWalletAddress:
 *                   type: string
 *                   description: Current dedicated wallet address from environment
 *                 dedicatedWalletName:
 *                   type: string
 *                   description: Current dedicated wallet name from environment
 *                 note:
 *                   type: string
 *                   description: Information about how to change the wallet address
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/wallet/address', async (req: Request, res: Response) => {
  try {
    const dedicatedWallet = DedicatedWalletService.getInstance();
    
    res.json({
      dedicatedWalletAddress: dedicatedWallet.getWalletAddress(),
      dedicatedWalletName: dedicatedWallet.getWalletName(),
      note: 'To change the dedicated wallet address, update the DEDICATED_WALLET_ADDRESS environment variable and restart the server.'
    });
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    res.status(500).json({
      message: 'Failed to fetch wallet address',
      error: 'Internal Server Error'
    });
  }
});

export default router;

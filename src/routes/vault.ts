import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateDeposit, validateWithdrawal, handleValidationErrors } from '../middleware/security';
import { MultisigVaultService } from '../services/multisigVaultService';
import FeeService from '../services/feeService';

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
      currency: 'USDC'
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
    const { userId, amount, currency = 'USDC', notes } = req.body;

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC is supported for vault operations'
      });
    }

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

    // Get or create vault using multisig vault service
    const multisigVault = MultisigVaultService.getInstance();
    const vault = await multisigVault.getOrCreateMultisigVault(currency);

    // Find or create vault record in database
    let vaultRecord = await prisma.vault.findUnique({
      where: { address: vault.multisigPda }
    });

    if (!vaultRecord) {
      vaultRecord = await prisma.vault.create({
        data: {
          address: vault.multisigPda,
          name: vault.name,
          totalBalance: 0,
          feeBalance: 0,
          currency: vault.currency,
          isActive: true
        }
      });
    }

    // Create deposit record
    const deposit = await prisma.deposit.create({
      data: {
        userId,
        vaultId: vaultRecord.id,
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

    // Update vault balance using multisig vault service
    await multisigVault.updateVaultBalance(
      vault.multisigPda,
      parseFloat(amount),
      'deposit'
    );

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
    const { userId, amount, currency = 'USDC', notes } = req.body;

    // Validate currency - only USDC allowed
    if (currency !== 'USDC') {
      return res.status(400).json({
        message: 'Invalid currency',
        error: 'Bad Request',
        details: 'Only USDC is supported for vault operations'
      });
    }

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

    // Get vault using multisig vault service
    const multisigVault = MultisigVaultService.getInstance();
    const vault = await multisigVault.getOrCreateMultisigVault(currency);

    // Find or create vault record in database
    let vaultRecord = await prisma.vault.findUnique({
      where: { address: vault.multisigPda }
    });

    if (!vaultRecord) {
      vaultRecord = await prisma.vault.create({
        data: {
          address: vault.multisigPda,
          name: vault.name,
          totalBalance: 0,
          feeBalance: 0,
          currency: vault.currency,
          isActive: true
        }
      });
    }

    // Create withdrawal record
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        vaultId: vaultRecord.id,
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

    // Update vault balance using multisig vault service
    await multisigVault.updateVaultBalance(
      vault.multisigPda,
      parseFloat(amount),
      'withdrawal'
    );

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
    const multisigVault = MultisigVaultService.getInstance();
    const status = await multisigVault.getMultisigVaultStatus();

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
 *     summary: Get current multisig wallet address (read-only)
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Multisig wallet address retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 multisigWalletAddress:
 *                   type: string
 *                   description: Current multisig PDA address
 *                 multisigWalletName:
 *                   type: string
 *                   description: Current multisig wallet name
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
    const multisigVault = MultisigVaultService.getInstance();
    
    res.json({
      multisigWalletAddress: multisigVault.getMultisigWalletAddress(),
      multisigWalletName: multisigVault.getMultisigWalletName(),
      note: 'This is the multisig PDA address that controls the main vault. To change it, create a new multisig and update the database.'
    });
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    res.status(500).json({
      message: 'Failed to fetch wallet address',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/fees/statistics:
 *   get:
 *     summary: Get fee statistics
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Currency to filter by (optional)
 *         example: "SOL"
 *     responses:
 *       200:
 *         description: Fee statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalFees:
 *                   type: number
 *                   format: decimal
 *                 feeCount:
 *                   type: integer
 *                 averageFee:
 *                   type: number
 *                   format: decimal
 *                 recentFees:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/fees/statistics', async (req: Request, res: Response) => {
  try {
    const { currency } = req.query;
    const statistics = await FeeService.getFeeStatistics(currency as string);

    res.json(statistics);
  } catch (error) {
    console.error('Error fetching fee statistics:', error);
    res.status(500).json({
      message: 'Failed to fetch fee statistics',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/fees/balance:
 *   get:
 *     summary: Get vault fee balance
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Currency to check balance for
 *         example: "SOL"
 *     responses:
 *       200:
 *         description: Fee balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feeBalance:
 *                   type: number
 *                   format: decimal
 *                 currency:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/fees/balance', async (req: Request, res: Response) => {
  try {
    const { currency = 'USDC' } = req.query;
    const feeBalance = await FeeService.getVaultFeeBalance(currency as string);

    res.json({
      feeBalance,
      currency
    });
  } catch (error) {
    console.error('Error fetching fee balance:', error);
    res.status(500).json({
      message: 'Failed to fetch fee balance',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/fees/calculate:
 *   post:
 *     summary: Calculate fee for a given amount
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
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to calculate fee for
 *                 example: 100
 *     responses:
 *       200:
 *         description: Fee calculation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   format: decimal
 *                 fee:
 *                   type: number
 *                   format: decimal
 *                 netAmount:
 *                   type: number
 *                   format: decimal
 *                 feeRate:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/fees/calculate', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({
        message: 'Valid amount is required',
        error: 'Bad Request'
      });
    }

    const { fee, netAmount } = FeeService.calculateFee(parseFloat(amount));

    res.json({
      amount: parseFloat(amount),
      fee,
      netAmount,
      feeRate: '0.001%'
    });
  } catch (error) {
    console.error('Error calculating fee:', error);
    res.status(500).json({
      message: 'Failed to calculate fee',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/fee-wallet/info:
 *   get:
 *     summary: Get fee wallet information
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Fee wallet information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   type: string
 *                   description: Fee wallet address
 *                 name:
 *                   type: string
 *                   description: Fee wallet name
 *                 isConfigured:
 *                   type: boolean
 *                   description: Whether fee wallet is properly configured
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/fee-wallet/info', async (req: Request, res: Response) => {
  try {
    const feeWalletInfo = FeeService.getFeeWalletInfo();
    const feeWalletStatus = FeeService.getFeeWalletStatus();

    res.json({
      ...feeWalletInfo,
      isConfigured: feeWalletStatus.isConfigured
    });
  } catch (error) {
    console.error('Error fetching fee wallet info:', error);
    res.status(500).json({
      message: 'Failed to fetch fee wallet info',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/fee-wallet/status:
 *   get:
 *     summary: Get fee wallet configuration status
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Fee wallet status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isConfigured:
 *                   type: boolean
 *                   description: Whether fee wallet is properly configured
 *                 address:
 *                   type: string
 *                   nullable: true
 *                   description: Fee wallet address (if configured)
 *                 name:
 *                   type: string
 *                   nullable: true
 *                   description: Fee wallet name (if configured)
 *                 error:
 *                   type: string
 *                   description: Error message (if not configured)
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/fee-wallet/status', async (req: Request, res: Response) => {
  try {
    const status = FeeService.getFeeWalletStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching fee wallet status:', error);
    res.status(500).json({
      message: 'Failed to fetch fee wallet status',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/vault/fee-wallet/address:
 *   get:
 *     summary: Get fee wallet address and configuration instructions
 *     tags: [Vault]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Fee wallet address and configuration info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feeWalletAddress:
 *                   type: string
 *                   description: Current fee wallet address
 *                 feeWalletName:
 *                   type: string
 *                   description: Current fee wallet name
 *                 isConfigured:
 *                   type: boolean
 *                   description: Whether fee wallet is properly configured
 *                 instructions:
 *                   type: string
 *                   description: Instructions on how to change the fee wallet
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/fee-wallet/address', async (req: Request, res: Response) => {
  try {
    const feeWalletInfo = FeeService.getFeeWalletInfo();
    const feeWalletStatus = FeeService.getFeeWalletStatus();

    res.json({
      feeWalletAddress: feeWalletInfo.address,
      feeWalletName: feeWalletInfo.name,
      isConfigured: feeWalletStatus.isConfigured,
      instructions: 'To change the fee wallet address, update the FEE_WALLET_ADDRESS and FEE_WALLET_NAME environment variables in the .env file and restart the server.'
    });
  } catch (error) {
    console.error('Error fetching fee wallet address:', error);
    res.status(500).json({
      message: 'Failed to fetch fee wallet address',
      error: 'Internal Server Error'
    });
  }
});

export default router;

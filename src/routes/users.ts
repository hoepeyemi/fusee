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
router.post('/', validateUser, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { email, fullName, phoneNumber, solanaWallet } = req.body;

    // Check if email or wallet already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { solanaWallet: solanaWallet as any }
        ]
      }
    });

    if (existingUser) {
      const conflictField = existingUser.email === email ? 'email' : 'Solana wallet';
      return res.status(409).json({
        message: `User with this ${conflictField} already exists`,
        error: 'Conflict'
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        fullName: fullName as any,
        phoneNumber,
        solanaWallet: solanaWallet as any,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      message: 'Failed to create user', 
      error: 'Internal Server Error' 
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
        error: 'Bad Request'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      message: 'Failed to fetch user',
      error: 'Internal Server Error'
    });
  }
});

export default router;

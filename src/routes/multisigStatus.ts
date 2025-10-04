import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { OnDemandMultisigService } from '../services/onDemandMultisigService';

const router = Router();

/**
 * @swagger
 * /api/multisig-status/{userId}:
 *   get:
 *     summary: Check if user has multisig account
 *     tags: [Multisig Status]
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
 *         description: Multisig status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                 hasMultisig:
 *                   type: boolean
 *                 multisigPda:
 *                   type: string
 *                 createKey:
 *                   type: string
 *                 threshold:
 *                   type: integer
 *                 timeLock:
 *                   type: integer
 *                 memberCount:
 *                   type: integer
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
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        message: 'Invalid user ID',
        error: 'Bad Request'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        hasMultisig: true,
        multisigPda: true,
        multisigCreateKey: true,
        multisigThreshold: true,
        multisigTimeLock: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: `User with ID ${userIdNum} not found`,
        error: 'Not Found'
      });
    }

    // Get member count if user has multisig
    let memberCount = 0;
    if (user.hasMultisig) {
      const members = await prisma.multisigMember.findMany({
        where: { userId: userIdNum },
        select: { id: true }
      });
      memberCount = members.length;
    }

    res.json({
      userId: user.id,
      hasMultisig: user.hasMultisig,
      multisigPda: user.multisigPda || null,
      createKey: user.multisigCreateKey || null,
      threshold: user.multisigThreshold || null,
      timeLock: user.multisigTimeLock || null,
      memberCount: memberCount
    });

  } catch (error) {
    console.error('Error checking multisig status:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-status/{userId}/create:
 *   post:
 *     summary: Create multisig account for user (if not exists)
 *     tags: [Multisig Status]
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
 *         description: Multisig status retrieved or created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                 hasMultisig:
 *                   type: boolean
 *                 multisigPda:
 *                   type: string
 *                 createKey:
 *                   type: string
 *                 isNewMultisig:
 *                   type: boolean
 *                 message:
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
router.post('/:userId/create', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        message: 'Invalid user ID',
        error: 'Bad Request'
      });
    }

    // Ensure user has multisig (create if needed)
    const multisigResult = await OnDemandMultisigService.ensureUserMultisig(userIdNum);

    // Get updated user details
    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        hasMultisig: true,
        multisigPda: true,
        multisigCreateKey: true,
        multisigThreshold: true,
        multisigTimeLock: true
      }
    });

    // Get member count
    const members = await prisma.multisigMember.findMany({
      where: { userId: userIdNum },
      select: { id: true }
    });

    res.json({
      userId: user!.id,
      hasMultisig: user!.hasMultisig,
      multisigPda: user!.multisigPda,
      createKey: user!.multisigCreateKey,
      threshold: user!.multisigThreshold,
      timeLock: user!.multisigTimeLock,
      memberCount: members.length,
      isNewMultisig: multisigResult.isNewMultisig,
      message: multisigResult.isNewMultisig 
        ? 'Multisig account created successfully' 
        : 'User already had multisig account'
    });

  } catch (error) {
    console.error('Error creating multisig:', error);
    res.status(500).json({
      message: 'Failed to create multisig account',
      error: 'Multisig Creation Failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

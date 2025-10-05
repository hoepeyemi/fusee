import { Router, Request, Response } from 'express';
import { UserMultisigService } from '../services/userMultisigService';
import { validateUserMultisig, handleValidationErrors } from '../middleware/security';

const router = Router();

/**
 * @swagger
 * /api/users/{userId}/multisig:
 *   post:
 *     summary: Create multisig for a user
 *     tags: [User Multisig]
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
 *                 description: Multisig name
 *                 example: "John's Multisig"
 *               threshold:
 *                 type: integer
 *                 description: Number of approvals required
 *                 example: 2
 *               timeLock:
 *                 type: integer
 *                 description: Time lock in seconds
 *                 example: 0
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     publicKey:
 *                       type: string
 *                       description: Member's public key
 *                       example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Member permissions
 *                       example: ["Proposer", "Voter", "Executor"]
 *     responses:
 *       201:
 *         description: Multisig created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Multisig created successfully"
 *                 multisigPda:
 *                   type: string
 *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *                 createKey:
 *                   type: string
 *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *                 threshold:
 *                   type: integer
 *                   example: 2
 *                 timeLock:
 *                   type: integer
 *                   example: 0
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - user already has multisig
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
router.post('/:userId/multisig', validateUserMultisig, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { name, threshold, timeLock, members } = req.body;

    const result = await UserMultisigService.createUserMultisig({
      userId: parseInt(userId),
      name,
      threshold,
      timeLock,
      members
    });

    res.status(201).json({
      message: 'Multisig created successfully',
      ...result
    });
  } catch (error) {
    console.error('Error creating user multisig:', error);
    res.status(500).json({
      message: 'Failed to create user multisig',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}/multisig:
 *   get:
 *     summary: Get user's multisig configuration
 *     tags: [User Multisig]
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
 *         description: User multisig configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 multisigPda:
 *                   type: string
 *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *                 createKey:
 *                   type: string
 *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
 *                 threshold:
 *                   type: integer
 *                   example: 2
 *                 timeLock:
 *                   type: integer
 *                   example: 0
 *                 hasMultisig:
 *                   type: boolean
 *                   example: true
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       publicKey:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       isActive:
 *                         type: boolean
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
router.get('/:userId/multisig', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const multisig = await UserMultisigService.getUserMultisig(parseInt(userId));

    if (!multisig) {
      return res.status(404).json({
        message: 'User not found',
        error: 'Not Found'
      });
    }

    res.json(multisig);
  } catch (error) {
    console.error('Error fetching user multisig:', error);
    res.status(500).json({
      message: 'Failed to fetch user multisig',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}/multisig:
 *   put:
 *     summary: Update user's multisig configuration
 *     tags: [User Multisig]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               threshold:
 *                 type: integer
 *                 description: Number of approvals required
 *                 example: 3
 *               timeLock:
 *                 type: integer
 *                 description: Time lock in seconds
 *                 example: 3600
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
 *                       description: Member permissions
 *     responses:
 *       200:
 *         description: Multisig updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Multisig updated successfully"
 *                 multisigPda:
 *                   type: string
 *                 createKey:
 *                   type: string
 *                 threshold:
 *                   type: integer
 *                 timeLock:
 *                   type: integer
 *                 hasMultisig:
 *                   type: boolean
 *                 members:
 *                   type: array
 *       404:
 *         description: User not found or no multisig configured
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
router.put('/:userId/multisig', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const result = await UserMultisigService.updateUserMultisig(parseInt(userId), updates);

    res.json({
      message: 'Multisig updated successfully',
      ...result
    });
  } catch (error) {
    console.error('Error updating user multisig:', error);
    res.status(500).json({
      message: 'Failed to update user multisig',
      error: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}/multisig:
 *   delete:
 *     summary: Delete user's multisig configuration
 *     tags: [User Multisig]
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
 *         description: Multisig deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Multisig deleted successfully"
 *       404:
 *         description: User not found or no multisig configured
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
router.delete('/:userId/multisig', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    await UserMultisigService.deleteUserMultisig(parseInt(userId));

    res.json({
      message: 'Multisig deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user multisig:', error);
    res.status(500).json({
      message: 'Failed to delete user multisig',
      error: 'Internal Server Error'
    });
  }
});

export default router;

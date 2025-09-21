import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { SignerManagementService } from '../services/signerManagementService';

const router = Router();

/**
 * @swagger
 * /api/signer-management/{multisigId}/inactive:
 *   get:
 *     summary: Get inactive members for a multisig
 *     tags: [Signer Management]
 *     parameters:
 *       - in: path
 *         name: multisigId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Multisig ID
 *     responses:
 *       200:
 *         description: Inactive members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MultisigMember'
 *       404:
 *         description: Multisig not found
 *       500:
 *         description: Internal server error
 */
router.get('/:multisigId/inactive', async (req: Request, res: Response) => {
  try {
    const { multisigId } = req.params;

    const inactiveMembers = await SignerManagementService.getInactiveMembers(parseInt(multisigId));

    res.json({
      success: true,
      data: inactiveMembers
    });
  } catch (error) {
    console.error('Error getting inactive members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inactive members',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/signer-management/{multisigId}/remove-inactive:
 *   post:
 *     summary: Remove inactive members from multisig
 *     tags: [Signer Management]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: multisigId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Multisig ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - removedByMemberId
 *             properties:
 *               removedByMemberId:
 *                 type: integer
 *                 description: ID of the member initiating the removal
 *     responses:
 *       200:
 *         description: Inactive members removed successfully
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
 *                     removedCount:
 *                       type: integer
 *                     removedMembers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MultisigMember'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/:multisigId/remove-inactive', [
  body('removedByMemberId').isInt().withMessage('Removed by member ID must be an integer'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { multisigId } = req.params;
    const { removedByMemberId } = req.body;

    const result = await SignerManagementService.removeInactiveMembers(
      parseInt(multisigId),
      removedByMemberId
    );

    res.json({
      success: true,
      message: `Removed ${result.removedCount} inactive members`,
      data: result
    });
  } catch (error) {
    console.error('Error removing inactive members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove inactive members',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/signer-management/{multisigId}/health:
 *   get:
 *     summary: Get multisig health status
 *     tags: [Signer Management]
 *     parameters:
 *       - in: path
 *         name: multisigId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Multisig ID
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
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
 *                     totalMembers:
 *                       type: integer
 *                     activeMembers:
 *                       type: integer
 *                     inactiveMembers:
 *                       type: integer
 *                     threshold:
 *                       type: integer
 *                     isHealthy:
 *                       type: boolean
 *                     warnings:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Multisig not found
 *       500:
 *         description: Internal server error
 */
router.get('/:multisigId/health', async (req: Request, res: Response) => {
  try {
    const { multisigId } = req.params;

    const health = await SignerManagementService.getMultisigHealth(parseInt(multisigId));

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error getting multisig health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get multisig health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/signer-management/{multisigId}/removal-history:
 *   get:
 *     summary: Get signer removal history
 *     tags: [Signer Management]
 *     parameters:
 *       - in: path
 *         name: multisigId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Multisig ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Removal history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MultisigSignerRemoval'
 *       500:
 *         description: Internal server error
 */
router.get('/:multisigId/removal-history', async (req: Request, res: Response) => {
  try {
    const { multisigId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const history = await SignerManagementService.getSignerRemovalHistory(
      parseInt(multisigId),
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting removal history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get removal history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/signer-management/check-inactive:
 *   post:
 *     summary: Manually trigger inactive member check
 *     tags: [Signer Management]
 *     security:
 *       - csrf: []
 *     responses:
 *       200:
 *         description: Inactive member check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/check-inactive', async (req: Request, res: Response) => {
  try {
    await SignerManagementService.processInactiveMembers();

    res.json({
      success: true,
      message: 'Inactive member check completed'
    });
  } catch (error) {
    console.error('Error checking inactive members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check inactive members',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

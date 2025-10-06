/**
 * Multisig Transfer Routes
 * 
 * API endpoints for managing multisig-required wallet transfers.
 */

import { Router, Request, Response } from 'express';
import { MultisigTransferService } from '../services/multisigTransferService';
import { verifyCSRFToken } from '../middleware/csrf';

const router = Router();

// Apply CSRF protection to all routes
router.use(verifyCSRFToken);

/**
 * @swagger
 * /api/multisig-transfers/propose:
 *   post:
 *     summary: Create a new multisig transfer proposal
 *     tags: [Multisig Transfers]
 *     security:
 *       - csrf: []
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
 *               - requestedBy
 *             properties:
 *               fromWallet:
 *                 type: string
 *                 description: Source wallet address (must be a user wallet)
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *               toWallet:
 *                 type: string
 *                 description: Destination wallet address
 *                 example: "FeeWallet1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to transfer
 *                 example: 1.5
 *               currency:
 *                 type: string
 *                 description: Currency type - USDC only
 *                 example: "USDC"
 *                 default: "USDC"
 *               notes:
 *                 type: string
 *                 description: Optional transfer notes
 *                 example: "Payment for services"
 *               requestedBy:
 *                 type: string
 *                 description: Public key or identifier of the requester
 *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *     responses:
 *       201:
 *         description: Transfer proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Transfer proposal created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/MultisigTransferProposal'
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Missing required fields: fromWallet, toWallet, amount, requestedBy"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to create transfer proposal"
 *                 details:
 *                   type: string
 *                   example: "Error message details"
 */
router.post('/propose', async (req: Request, res: Response) => {
  try {
    const { fromWallet, toWallet, amount, currency, notes, requestedBy } = req.body;

    // Validate required fields
    if (!fromWallet || !toWallet || !amount || !requestedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromWallet, toWallet, amount, requestedBy'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    // Check if transfer requires multisig approval
    const requiresApproval = await MultisigTransferService.requiresMultisigApproval(
      fromWallet,
      toWallet
    );

    if (!requiresApproval) {
      return res.status(400).json({
        success: false,
        error: 'Transfer does not require multisig approval (not between users)'
      });
    }

    // Create transfer proposal
    const proposal = await MultisigTransferService.createTransferProposal({
      fromWallet,
      toWallet,
      amount: parseFloat(amount),
      currency: currency || 'USDC',
      notes,
      requestedBy
    });

    res.status(201).json({
      success: true,
      message: 'Transfer proposal created successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Error creating transfer proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create transfer proposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-transfers/proposals:
 *   get:
 *     summary: Get all transfer proposals
 *     tags: [Multisig Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PENDING_APPROVAL, APPROVED, EXECUTED, REJECTED, CANCELLED, FAILED]
 *         description: Filter proposals by status
 *     responses:
 *       200:
 *         description: Transfer proposals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     proposals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MultisigTransferProposal'
 *                     count:
 *                       type: integer
 *                       example: 5
 *       500:
 *         description: Internal server error
 */
router.get('/proposals', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let proposals;
    if (status) {
      proposals = await MultisigTransferService.getProposalsByStatus(status as any);
    } else {
      proposals = await MultisigTransferService.getPendingProposals();
    }

    res.json({
      success: true,
      data: {
        proposals,
        count: proposals.length
      }
    });
  } catch (error) {
    console.error('Error getting transfer proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transfer proposals',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/multisig-transfers/proposals/:id
 * Get a specific transfer proposal
 */
router.get('/proposals/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const proposalId = parseInt(id);

    if (isNaN(proposalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposal ID'
      });
    }

    const proposal = await MultisigTransferService.getProposalById(proposalId);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Transfer proposal not found'
      });
    }

    res.json({
      success: true,
      data: proposal
    });
  } catch (error) {
    console.error('Error getting transfer proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transfer proposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/multisig-transfers/proposals/:id/approve
 * Approve a transfer proposal
 */
router.post('/proposals/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approverPublicKey } = req.body;
    const proposalId = parseInt(id);

    if (isNaN(proposalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposal ID'
      });
    }

    if (!approverPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'Approver public key is required'
      });
    }

    const success = await MultisigTransferService.approveProposal(
      proposalId,
      approverPublicKey
    );

    if (success) {
      res.json({
        success: true,
        message: 'Transfer proposal approved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to approve transfer proposal'
      });
    }
  } catch (error) {
    console.error('Error approving transfer proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve transfer proposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/multisig-transfers/proposals/:id/reject
 * Reject a transfer proposal
 */
router.post('/proposals/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectorPublicKey, reason } = req.body;
    const proposalId = parseInt(id);

    if (isNaN(proposalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposal ID'
      });
    }

    if (!rejectorPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'Rejector public key is required'
      });
    }

    const success = await MultisigTransferService.rejectProposal(
      proposalId,
      rejectorPublicKey,
      reason
    );

    if (success) {
      res.json({
        success: true,
        message: 'Transfer proposal rejected successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to reject transfer proposal'
      });
    }
  } catch (error) {
    console.error('Error rejecting transfer proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject transfer proposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/multisig-transfers/proposals/:id/execute
 * Execute an approved transfer proposal
 */
router.post('/proposals/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { executorPublicKey } = req.body;
    const proposalId = parseInt(id);

    if (isNaN(proposalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposal ID'
      });
    }

    if (!executorPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'Executor public key is required'
      });
    }

    const result = await MultisigTransferService.executeProposal(
      proposalId,
      executorPublicKey
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Transfer executed successfully',
        data: {
          transactionHash: result.transactionHash
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to execute transfer',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Error executing transfer proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute transfer proposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/multisig-transfers/stats
 * Get transfer statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await MultisigTransferService.getTransferStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting transfer stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transfer statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-transfers/check-requirement:
 *   get:
 *     summary: Check if a transfer requires multisig approval
 *     tags: [Multisig Transfers]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: fromWallet
 *         required: true
 *         schema:
 *           type: string
 *         description: Source wallet address
 *         example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *       - in: query
 *         name: toWallet
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination wallet address
 *         example: "FeeWallet1234567890123456789012345678901234567890"
 *     responses:
 *       200:
 *         description: Transfer requirement checked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     requiresApproval:
 *                       type: boolean
 *                       description: Whether the transfer requires multisig approval
 *                       example: true
 *                     fromWallet:
 *                       type: string
 *                       description: Source wallet address
 *                     toWallet:
 *                       type: string
 *                       description: Destination wallet address
 *       400:
 *         description: Bad request - missing required parameters
 *       500:
 *         description: Internal server error
 */
router.get('/check-requirement', async (req: Request, res: Response) => {
  try {
    const { fromWallet, toWallet } = req.query;

    if (!fromWallet || !toWallet) {
      return res.status(400).json({
        success: false,
        error: 'fromWallet and toWallet are required'
      });
    }

    const requiresApproval = await MultisigTransferService.requiresMultisigApproval(
      fromWallet as string,
      toWallet as string
    );

    res.json({
      success: true,
      data: {
        requiresApproval,
        fromWallet,
        toWallet
      }
    });
  } catch (error) {
    console.error('Error checking transfer requirement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check transfer requirement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


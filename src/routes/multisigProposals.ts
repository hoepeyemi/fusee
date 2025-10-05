import { Router, Request, Response } from 'express';
import { MultisigProposalService } from '../services/multisigProposalService';

const router = Router();

/**
 * @swagger
 * /api/multisig-proposals:
 *   get:
 *     summary: Get all pending multisig proposals
 *     tags: [Multisig Proposals]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: query
 *         name: multisigPda
 *         schema:
 *           type: string
 *         description: Multisig PDA address
 *         example: "MultisigPDA123..."
 *     responses:
 *       200:
 *         description: Pending proposals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proposals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       fromWallet:
 *                         type: string
 *                       toWallet:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       memo:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { multisigPda } = req.query;

    if (!multisigPda) {
      return res.status(400).json({
        message: 'Multisig PDA is required',
        error: 'Bad Request'
      });
    }

    const proposalService = MultisigProposalService.getInstance();
    const proposals = await proposalService.getPendingProposals(multisigPda as string);

    res.json({
      proposals,
      count: proposals.length
    });

  } catch (error) {
    console.error('Error getting pending proposals:', error);
    res.status(500).json({
      message: 'Failed to get pending proposals',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-proposals/{proposalId}/approve:
 *   post:
 *     summary: Approve a multisig proposal
 *     tags: [Multisig Proposals]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Proposal ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberPublicKey
 *             properties:
 *               memberPublicKey:
 *                 type: string
 *                 description: Public key of the approving member
 *                 example: "MemberPublicKey123..."
 *     responses:
 *       200:
 *         description: Proposal approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
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
router.post('/:proposalId/approve', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { memberPublicKey } = req.body;

    if (!memberPublicKey) {
      return res.status(400).json({
        message: 'Member public key is required',
        error: 'Bad Request'
      });
    }

    const proposalService = MultisigProposalService.getInstance();
    const success = await proposalService.approveProposal(
      parseInt(proposalId),
      memberPublicKey
    );

    if (success) {
      res.json({
        success: true,
        message: 'Proposal approved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to approve proposal'
      });
    }

  } catch (error) {
    console.error('Error approving proposal:', error);
    res.status(500).json({
      message: 'Failed to approve proposal',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-proposals/{proposalId}/reject:
 *   post:
 *     summary: Reject a multisig proposal
 *     tags: [Multisig Proposals]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Proposal ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberPublicKey
 *             properties:
 *               memberPublicKey:
 *                 type: string
 *                 description: Public key of the rejecting member
 *                 example: "MemberPublicKey123..."
 *     responses:
 *       200:
 *         description: Proposal rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
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
router.post('/:proposalId/reject', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { memberPublicKey } = req.body;

    if (!memberPublicKey) {
      return res.status(400).json({
        message: 'Member public key is required',
        error: 'Bad Request'
      });
    }

    const proposalService = MultisigProposalService.getInstance();
    const success = await proposalService.rejectProposal(
      parseInt(proposalId),
      memberPublicKey
    );

    if (success) {
      res.json({
        success: true,
        message: 'Proposal rejected successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to reject proposal'
      });
    }

  } catch (error) {
    console.error('Error rejecting proposal:', error);
    res.status(500).json({
      message: 'Failed to reject proposal',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-proposals/{proposalId}/execute:
 *   post:
 *     summary: Execute an approved multisig proposal
 *     tags: [Multisig Proposals]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Proposal ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - executorPublicKey
 *             properties:
 *               executorPublicKey:
 *                 type: string
 *                 description: Public key of the executing member
 *                 example: "ExecutorPublicKey123..."
 *     responses:
 *       200:
 *         description: Proposal executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transactionHash:
 *                   type: string
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
router.post('/:proposalId/execute', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { executorPublicKey } = req.body;

    if (!executorPublicKey) {
      return res.status(400).json({
        message: 'Executor public key is required',
        error: 'Bad Request'
      });
    }

    const proposalService = MultisigProposalService.getInstance();
    const success = await proposalService.executeProposal(
      parseInt(proposalId),
      executorPublicKey
    );

    if (success) {
      res.json({
        success: true,
        message: 'Proposal executed successfully',
        transactionHash: `EXEC_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to execute proposal'
      });
    }

  } catch (error) {
    console.error('Error executing proposal:', error);
    
    // Handle time lock specific errors
    if (error instanceof Error && error.message.includes('Time lock not expired')) {
      return res.status(400).json({
        message: 'Cannot execute proposal',
        error: 'Time Lock Active',
        details: error.message
      });
    }
    
    // Handle other specific errors
    if (error instanceof Error && (
      error.message.includes('Proposal not found') ||
      error.message.includes('must be approved') ||
      error.message.includes('must be a multisig member')
    )) {
      return res.status(400).json({
        message: 'Cannot execute proposal',
        error: 'Bad Request',
        details: error.message
      });
    }
    
    res.status(500).json({
      message: 'Failed to execute proposal',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-proposals/{proposalId}/time-lock-status:
 *   get:
 *     summary: Get proposal time lock status
 *     tags: [Multisig Proposals]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Proposal ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Time lock status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canExecute:
 *                   type: boolean
 *                   description: Whether the proposal can be executed
 *                 timeLock:
 *                   type: integer
 *                   description: Time lock duration in seconds
 *                 timeRemaining:
 *                   type: integer
 *                   description: Time remaining in seconds (if applicable)
 *                 reason:
 *                   type: string
 *                   description: Reason why proposal cannot be executed (if applicable)
 *                 latestApprovalTime:
 *                   type: string
 *                   format: date-time
 *                   description: Time of the latest approval
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
router.get('/:proposalId/time-lock-status', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const proposalIdNum = parseInt(proposalId);

    if (isNaN(proposalIdNum)) {
      return res.status(400).json({
        message: 'Invalid proposal ID',
        error: 'Bad Request'
      });
    }

    const proposalService = MultisigProposalService.getInstance();
    const timeLockStatus = await proposalService.getProposalTimeLockStatus(proposalIdNum);

    res.json({
      message: 'Time lock status retrieved successfully',
      ...timeLockStatus
    });

  } catch (error) {
    console.error('Error getting time lock status:', error);
    res.status(500).json({
      message: 'Failed to get time lock status',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/multisig-proposals/{proposalId}/status:
 *   get:
 *     summary: Get proposal status
 *     tags: [Multisig Proposals]
 *     security:
 *       - csrf: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Proposal ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Proposal status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 status:
 *                   type: string
 *                 fromWallet:
 *                   type: string
 *                 toWallet:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency:
 *                   type: string
 *                 memo:
 *                   type: string
 *                 transactionHash:
 *                   type: string
 *                 approvals:
 *                   type: integer
 *                 threshold:
 *                   type: integer
 *                 timeLock:
 *                   type: integer
 *                   description: Time lock duration in seconds
 *                 canExecute:
 *                   type: boolean
 *                   description: Whether the proposal can be executed
 *                 timeRemaining:
 *                   type: integer
 *                   description: Time remaining in seconds (if applicable)
 *                 timeLockReason:
 *                   type: string
 *                   description: Reason why proposal cannot be executed (if applicable)
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Proposal not found
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
router.get('/:proposalId/status', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;

    const proposalService = MultisigProposalService.getInstance();
    const status = await proposalService.getProposalStatus(parseInt(proposalId));

    res.json(status);

  } catch (error) {
    console.error('Error getting proposal status:', error);
    
    if (error.message.includes('Proposal not found')) {
      return res.status(404).json({
        message: 'Proposal not found',
        error: 'Not Found'
      });
    }

    res.status(500).json({
      message: 'Failed to get proposal status',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

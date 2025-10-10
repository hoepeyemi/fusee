import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import AutomaticMultisigService from '../services/automaticMultisigService';

const router = Router();

/**
 * @swagger
 * /api/transfer-status/{transferId}:
 *   get:
 *     summary: Get transfer status by transfer ID
 *     tags: [Transfer Status]
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer ID
 *         example: 123
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [first-name, wallet, external, multisig]
 *         description: Type of transfer to check
 *         example: "wallet"
 *     responses:
 *       200:
 *         description: Transfer status retrieved successfully
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
 *                     transferId:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     status:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     fromWallet:
 *                       type: string
 *                     toWallet:
 *                       type: string
 *                     transactionHash:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     multisigInfo:
 *                       type: object
 *                       properties:
 *                         proposalId:
 *                           type: integer
 *                         approvals:
 *                           type: integer
 *                         threshold:
 *                           type: integer
 *                         canExecute:
 *                           type: boolean
 *                         executedBy:
 *                           type: array
 *                           items:
 *                             type: string
 *       404:
 *         description: Transfer not found
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
router.get('/:transferId', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const { type } = req.query;
    
    const id = parseInt(transferId);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transfer ID'
      });
    }

    let transfer: any = null;
    let transferType = 'unknown';

    // Try to find the transfer in different tables based on type
    if (type === 'first-name' || !type) {
      // Check first-name transfers
      transfer = await prisma.transfer.findUnique({
        where: { id },
        include: {
          sender: { select: { firstName: true, fullName: true } },
          receiver: { select: { firstName: true, fullName: true } }
        }
      });
      if (transfer) {
        transferType = 'first-name';
        transfer.fromWallet = transfer.sender ? (transfer.sender.firstName || transfer.sender.fullName) : 'Unknown';
        transfer.toWallet = transfer.receiver ? (transfer.receiver.firstName || transfer.receiver.fullName) : 'Unknown';
      }
    }

    if (!transfer && (type === 'wallet' || !type)) {
      // Check wallet transfers
      transfer = await prisma.walletTransfer.findUnique({
        where: { id }
      });
      if (transfer) {
        transferType = 'wallet';
      }
    }

    if (!transfer && (type === 'external' || !type)) {
      // Check external transfers
      transfer = await prisma.externalTransfer.findUnique({
        where: { id },
        include: {
          user: { select: { firstName: true, fullName: true } }
        }
      });
      if (transfer) {
        transferType = 'external';
        transfer.fromWallet = transfer.user ? (transfer.user.firstName || transfer.user.fullName) : 'Unknown';
        transfer.toWallet = transfer.toExternalWallet;
      }
    }

    if (!transfer && (type === 'multisig' || !type)) {
      // Check multisig transfer proposals
      transfer = await prisma.multisigTransferProposal.findUnique({
        where: { id }
      });
      if (transfer) {
        transferType = 'multisig';
      }
    }

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found'
      });
    }

    // Get multisig information if applicable
    let multisigInfo = null;
    if (transferType === 'multisig') {
      // For multisig transfer proposals, we can only show basic info since there are no relations
      multisigInfo = {
        proposalId: transfer.id,
        status: transfer.status,
        multisigPda: transfer.multisigPda,
        requestedBy: transfer.requestedBy,
        canExecute: transfer.status === 'PENDING' // Basic check
      };
    } else if (transferType === 'wallet' && transfer.status === 'PENDING_APPROVAL') {
      // For wallet transfers, check if there's a multisig proposal
      const multisigProposal = await prisma.multisigTransferProposal.findFirst({
        where: {
          fromWallet: transfer.fromWallet,
          toWallet: transfer.toWallet,
          amount: transfer.amount,
          status: 'PENDING'
        }
      });

      if (multisigProposal) {
        multisigInfo = {
          proposalId: multisigProposal.id,
          status: multisigProposal.status,
          multisigPda: multisigProposal.multisigPda,
          requestedBy: multisigProposal.requestedBy,
          canExecute: multisigProposal.status === 'PENDING'
        };
      }
    }

    // Format the response
    const response = {
      success: true,
      data: {
        transferId: transfer.id,
        type: transferType,
        status: transfer.status,
        amount: Number(transfer.amount),
        currency: transfer.currency || 'USDC',
        fromWallet: transfer.fromWallet,
        toWallet: transfer.toWallet || transfer.toExternalWallet,
        transactionHash: transfer.transactionHash,
        createdAt: transfer.createdAt,
        updatedAt: transfer.updatedAt,
        ...(multisigInfo && { multisigInfo })
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error getting transfer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transfer status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/transfer-status/proposal/{proposalId}:
 *   get:
 *     summary: Get multisig proposal status
 *     tags: [Transfer Status]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Multisig proposal ID
 *         example: 123
 *     responses:
 *       200:
 *         description: Proposal status retrieved successfully
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
 *                     proposalId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     approvals:
 *                       type: integer
 *                     threshold:
 *                       type: integer
 *                     canExecute:
 *                       type: boolean
 *                     executedBy:
 *                       type: array
 *                       items:
 *                         type: string
 *                     transactionHash:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
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
router.get('/proposal/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const id = parseInt(proposalId);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposal ID'
      });
    }

    const automaticMultisigService = AutomaticMultisigService.getInstance();
    const status = await automaticMultisigService.getProposalStatus(id);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting proposal status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get proposal status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/transfer-status/execute/{proposalId}:
 *   post:
 *     summary: Automatically execute a multisig proposal
 *     tags: [Transfer Status]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Multisig proposal ID to execute
 *         example: 123
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     proposalId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     transactionHash:
 *                       type: string
 *                     executedBy:
 *                       type: array
 *                       items:
 *                         type: string
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
router.post('/execute/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const id = parseInt(proposalId);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposal ID'
      });
    }

    const automaticMultisigService = AutomaticMultisigService.getInstance();
    const result = await automaticMultisigService.executeProposalAutomatically(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Proposal executed successfully',
        data: {
          proposalId: result.proposalId,
          status: result.status,
          transactionHash: result.transactionHash,
          executedBy: result.executedBy
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to execute proposal',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Error executing proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute proposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/transfer-status/process-all:
 *   post:
 *     summary: Process all pending multisig proposals automatically
 *     tags: [Transfer Status]
 *     responses:
 *       200:
 *         description: All pending proposals processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     processed:
 *                       type: integer
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/process-all', async (req: Request, res: Response) => {
  try {
    const automaticMultisigService = AutomaticMultisigService.getInstance();
    const result = await automaticMultisigService.processAllPendingProposals();

    res.json({
      success: true,
      message: `Processed ${result.processed} proposals: ${result.successful} successful, ${result.failed} failed`,
      data: result
    });

  } catch (error) {
    console.error('Error processing all proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process all proposals',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

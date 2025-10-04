/**
 * Admin Inactivity Routes
 * 
 * API endpoints for managing admin inactivity detection and removal.
 */

import { Router } from 'express';
import { adminInactivityService } from '../services/adminInactivityService';
import { verifyCSRFToken } from '../middleware/csrf';

const router = Router();

// Apply CSRF protection to all routes
router.use(verifyCSRFToken);

/**
 * GET /api/admin-inactivity/status
 * Get current admin activity status
 */
router.get('/status', async (req, res) => {
  try {
    const activity = await adminInactivityService.getAllAdminActivity();
    
    res.json({
      success: true,
      data: {
        admins: activity,
        total: activity.length,
        active: activity.filter(a => !a.isInactive).length,
        inactive: activity.filter(a => a.isInactive).length,
        removalEligible: activity.filter(a => 
          a.isInactive && a.hoursSinceActivity >= 48
        ).length
      }
    });
  } catch (error) {
    console.error('Error getting admin activity status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin activity status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin-inactivity/stats
 * Get inactivity statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await adminInactivityService.getInactivityStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting inactivity stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inactivity stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin-inactivity/removal-eligible
 * Get admins eligible for removal
 */
router.get('/removal-eligible', async (req, res) => {
  try {
    const eligibleAdmins = await adminInactivityService.getRemovalEligibleAdmins();
    
    res.json({
      success: true,
      data: {
        admins: eligibleAdmins,
        count: eligibleAdmins.length
      }
    });
  } catch (error) {
    console.error('Error getting removal eligible admins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get removal eligible admins',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin-inactivity/update-activity
 * Update admin activity timestamp
 */
router.post('/update-activity', async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Public key is required'
      });
    }

    await adminInactivityService.updateAdminActivity(publicKey);
    
    res.json({
      success: true,
      message: 'Admin activity updated successfully'
    });
  } catch (error) {
    console.error('Error updating admin activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin-inactivity/check-inactive
 * Manually check for inactive admins
 */
router.post('/check-inactive', async (req, res) => {
  try {
    const inactiveAdmins = await adminInactivityService.checkInactiveAdmins();
    
    res.json({
      success: true,
      data: {
        admins: inactiveAdmins,
        count: inactiveAdmins.length
      },
      message: `Found ${inactiveAdmins.length} inactive admins`
    });
  } catch (error) {
    console.error('Error checking inactive admins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check inactive admins',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/admin-inactivity/remove/:publicKey
 * Remove inactive admin
 */
router.delete('/remove/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { reason } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Public key is required'
      });
    }

    const removed = await adminInactivityService.removeInactiveAdmin(publicKey, reason);
    
    if (removed) {
      res.json({
        success: true,
        message: `Admin ${publicKey} removed successfully`,
        data: { publicKey, reason }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to remove admin'
      });
    }
  } catch (error) {
    console.error('Error removing inactive admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove inactive admin',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin-inactivity/remove-all-eligible
 * Remove all admins eligible for removal
 */
router.post('/remove-all-eligible', async (req, res) => {
  try {
    const eligibleAdmins = await adminInactivityService.getRemovalEligibleAdmins();
    const results = [];
    
    for (const admin of eligibleAdmins) {
      try {
        await adminInactivityService.removeInactiveAdmin(admin.publicKey, 'Bulk removal - inactive for 48+ hours');
        results.push({
          publicKey: admin.publicKey,
          success: true,
          hoursInactive: admin.hoursSinceActivity
        });
      } catch (error) {
        results.push({
          publicKey: admin.publicKey,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Removed ${successCount} admins, ${failureCount} failed`,
      data: {
        results,
        summary: {
          total: eligibleAdmins.length,
          successful: successCount,
          failed: failureCount
        }
      }
    });
  } catch (error) {
    console.error('Error removing all eligible admins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove eligible admins',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


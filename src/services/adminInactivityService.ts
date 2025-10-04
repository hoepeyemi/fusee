/**
 * Admin Inactivity Service
 * 
 * This service handles tracking admin activity and removing inactive admins
 * after 48 hours of inactivity.
 */

import { prisma } from '../lib/prisma';

export interface InactivityConfig {
  inactivityThresholdHours: number; // Hours before considering admin inactive
  removalThresholdHours: number;    // Hours before admin can be removed
  checkIntervalMinutes: number;     // How often to check for inactive admins
}

export interface AdminActivity {
  memberId: number;
  publicKey: string;
  lastActivityAt: Date;
  isInactive: boolean;
  inactiveSince?: Date;
  removalEligibleAt?: Date;
  hoursSinceActivity: number;
}

export class AdminInactivityService {
  private config: InactivityConfig;

  constructor(config?: Partial<InactivityConfig>) {
    this.config = {
      inactivityThresholdHours: 24,  // Consider inactive after 24 hours
      removalThresholdHours: 48,     // Can be removed after 48 hours
      checkIntervalMinutes: 60,      // Check every hour
      ...config
    };
  }

  /**
   * Update admin activity timestamp
   */
  async updateAdminActivity(publicKey: string): Promise<void> {
    try {
      await prisma.multisigMember.updateMany({
        where: { publicKey },
        data: {
          lastActivityAt: new Date(),
          isInactive: false,
          inactiveSince: null,
          removalEligibleAt: null
        }
      });
      
      console.log(`✅ Updated activity for admin: ${publicKey}`);
    } catch (error) {
      console.error(`❌ Failed to update activity for admin ${publicKey}:`, error);
      throw error;
    }
  }

  /**
   * Check for inactive admins and update their status
   */
  async checkInactiveAdmins(): Promise<AdminActivity[]> {
    const now = new Date();
    const inactivityThreshold = new Date(now.getTime() - (this.config.inactivityThresholdHours * 60 * 60 * 1000));
    const removalThreshold = new Date(now.getTime() - (this.config.removalThresholdHours * 60 * 60 * 1000));

    try {
      // Find admins who haven't been active recently
      const inactiveAdmins = await prisma.multisigMember.findMany({
        where: {
          isActive: true,
          lastActivityAt: {
            lt: inactivityThreshold
          }
        },
        include: {
          multisig: true,
          user: true
        }
      });

      const updatedAdmins: AdminActivity[] = [];

      for (const admin of inactiveAdmins) {
        const hoursSinceActivity = Math.floor(
          (now.getTime() - admin.lastActivityAt.getTime()) / (1000 * 60 * 60)
        );

        const isInactive = hoursSinceActivity >= this.config.inactivityThresholdHours;
        const isRemovalEligible = hoursSinceActivity >= this.config.removalThresholdHours;

        // Update admin status if it has changed
        if (admin.isInactive !== isInactive) {
          await prisma.multisigMember.update({
            where: { id: admin.id },
            data: {
              isInactive,
              inactiveSince: isInactive ? now : null,
              removalEligibleAt: isRemovalEligible ? now : null
            }
          });

          console.log(`📊 Admin ${admin.publicKey} status updated: inactive=${isInactive}, removalEligible=${isRemovalEligible}`);
        }

        updatedAdmins.push({
          memberId: admin.id,
          publicKey: admin.publicKey,
          lastActivityAt: admin.lastActivityAt,
          isInactive,
          inactiveSince: isInactive ? now : undefined,
          removalEligibleAt: isRemovalEligible ? now : undefined,
          hoursSinceActivity
        });
      }

      return updatedAdmins;
    } catch (error) {
      console.error('❌ Failed to check inactive admins:', error);
      throw error;
    }
  }

  /**
   * Get admins eligible for removal
   */
  async getRemovalEligibleAdmins(): Promise<AdminActivity[]> {
    const now = new Date();
    const removalThreshold = new Date(now.getTime() - (this.config.removalThresholdHours * 60 * 60 * 1000));

    try {
      const eligibleAdmins = await prisma.multisigMember.findMany({
        where: {
          isActive: true,
          isInactive: true,
          lastActivityAt: {
            lt: removalThreshold
          }
        },
        include: {
          multisig: true,
          user: true
        }
      });

      return eligibleAdmins.map(admin => {
        const hoursSinceActivity = Math.floor(
          (now.getTime() - admin.lastActivityAt.getTime()) / (1000 * 60 * 60)
        );

        return {
          memberId: admin.id,
          publicKey: admin.publicKey,
          lastActivityAt: admin.lastActivityAt,
          isInactive: admin.isInactive,
          inactiveSince: admin.inactiveSince || undefined,
          removalEligibleAt: admin.removalEligibleAt || undefined,
          hoursSinceActivity
        };
      });
    } catch (error) {
      console.error('❌ Failed to get removal eligible admins:', error);
      throw error;
    }
  }

  /**
   * Remove inactive admin from multisig
   */
  async removeInactiveAdmin(publicKey: string, reason?: string): Promise<boolean> {
    try {
      const admin = await prisma.multisigMember.findFirst({
        where: { publicKey },
        include: { multisig: true }
      });

      if (!admin) {
        throw new Error(`Admin with public key ${publicKey} not found`);
      }

      if (!admin.isInactive) {
        throw new Error(`Admin ${publicKey} is not inactive and cannot be removed`);
      }

      const hoursSinceActivity = Math.floor(
        (new Date().getTime() - admin.lastActivityAt.getTime()) / (1000 * 60 * 60)
      );

      if (hoursSinceActivity < this.config.removalThresholdHours) {
        throw new Error(`Admin ${publicKey} is not eligible for removal yet (${hoursSinceActivity}h < ${this.config.removalThresholdHours}h)`);
      }

      // Deactivate the admin
      await prisma.multisigMember.update({
        where: { id: admin.id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      console.log(`🗑️ Removed inactive admin: ${publicKey} (inactive for ${hoursSinceActivity} hours)`);
      console.log(`   Reason: ${reason || 'Inactive for 48+ hours'}`);
      console.log(`   Multisig: ${admin.multisig?.multisigPda || 'N/A'}`);

      return true;
    } catch (error) {
      console.error(`❌ Failed to remove inactive admin ${publicKey}:`, error);
      throw error;
    }
  }

  /**
   * Get all admin activity status
   */
  async getAllAdminActivity(): Promise<AdminActivity[]> {
    try {
      const admins = await prisma.multisigMember.findMany({
        where: { isActive: true },
        include: { multisig: true, user: true },
        orderBy: { lastActivityAt: 'desc' }
      });

      const now = new Date();

      return admins.map(admin => {
        const hoursSinceActivity = Math.floor(
          (now.getTime() - admin.lastActivityAt.getTime()) / (1000 * 60 * 60)
        );

        return {
          memberId: admin.id,
          publicKey: admin.publicKey,
          lastActivityAt: admin.lastActivityAt,
          isInactive: admin.isInactive,
          inactiveSince: admin.inactiveSince || undefined,
          removalEligibleAt: admin.removalEligibleAt || undefined,
          hoursSinceActivity
        };
      });
    } catch (error) {
      console.error('❌ Failed to get admin activity:', error);
      throw error;
    }
  }

  /**
   * Start background monitoring for inactive admins
   */
  startMonitoring(): void {
    console.log(`🔄 Starting admin inactivity monitoring (check every ${this.config.checkIntervalMinutes} minutes)`);
    
    setInterval(async () => {
      try {
        console.log('🔍 Checking for inactive admins...');
        const inactiveAdmins = await this.checkInactiveAdmins();
        
        if (inactiveAdmins.length > 0) {
          console.log(`📊 Found ${inactiveAdmins.length} inactive admins`);
          
          const removalEligible = await this.getRemovalEligibleAdmins();
          if (removalEligible.length > 0) {
            console.log(`⚠️ ${removalEligible.length} admins are eligible for removal`);
            for (const admin of removalEligible) {
              console.log(`   - ${admin.publicKey} (inactive for ${admin.hoursSinceActivity}h)`);
            }
          }
        } else {
          console.log('✅ No inactive admins found');
        }
      } catch (error) {
        console.error('❌ Error in admin inactivity monitoring:', error);
      }
    }, this.config.checkIntervalMinutes * 60 * 1000);
  }

  /**
   * Get inactivity statistics
   */
  async getInactivityStats(): Promise<{
    totalAdmins: number;
    activeAdmins: number;
    inactiveAdmins: number;
    removalEligibleAdmins: number;
    averageInactivityHours: number;
  }> {
    try {
      const allAdmins = await this.getAllAdminActivity();
      const activeAdmins = allAdmins.filter(admin => !admin.isInactive);
      const inactiveAdmins = allAdmins.filter(admin => admin.isInactive);
      const removalEligible = allAdmins.filter(admin => 
        admin.isInactive && admin.hoursSinceActivity >= this.config.removalThresholdHours
      );

      const averageInactivityHours = allAdmins.length > 0 
        ? allAdmins.reduce((sum, admin) => sum + admin.hoursSinceActivity, 0) / allAdmins.length
        : 0;

      return {
        totalAdmins: allAdmins.length,
        activeAdmins: activeAdmins.length,
        inactiveAdmins: inactiveAdmins.length,
        removalEligibleAdmins: removalEligible.length,
        averageInactivityHours: Math.round(averageInactivityHours * 100) / 100
      };
    } catch (error) {
      console.error('❌ Failed to get inactivity stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const adminInactivityService = new AdminInactivityService({
  inactivityThresholdHours: 24,  // Consider inactive after 24 hours
  removalThresholdHours: 48,     // Can be removed after 48 hours
  checkIntervalMinutes: 60       // Check every hour
});


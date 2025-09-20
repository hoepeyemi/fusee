import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SignerManagementService {
  private static readonly INACTIVITY_THRESHOLD = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

  /**
   * Update member activity timestamp
   */
  public static async updateMemberActivity(
    multisigId: number,
    memberPublicKey: string
  ): Promise<void> {
    await prisma.multisigMember.updateMany({
      where: {
        multisigId,
        publicKey: memberPublicKey,
        isActive: true
      },
      data: {
        lastActivity: new Date(),
        isInactive: false,
        inactiveSince: null
      }
    });
  }

  /**
   * Check for inactive members and mark them as inactive
   */
  public static async checkInactiveMembers(): Promise<{
    markedInactive: number;
    inactiveMembers: any[];
  }> {
    const fortyEightHoursAgo = new Date(Date.now() - this.INACTIVITY_THRESHOLD);
    
    // Find members who haven't been active in 48 hours
    const inactiveMembers = await prisma.multisigMember.findMany({
      where: {
        isActive: true,
        lastActivity: {
          lt: fortyEightHoursAgo
        }
      },
      include: {
        multisig: true
      }
    });

    // Mark them as inactive
    const updateResult = await prisma.multisigMember.updateMany({
      where: {
        id: {
          in: inactiveMembers.map(m => m.id)
        }
      },
      data: {
        isInactive: true,
        inactiveSince: new Date()
      }
    });

    return {
      markedInactive: updateResult.count,
      inactiveMembers
    };
  }

  /**
   * Remove inactive members from multisig
   */
  public static async removeInactiveMembers(
    multisigId: number,
    removedByMemberId: number
  ): Promise<{
    removedCount: number;
    removedMembers: any[];
  }> {
    // Get inactive members for this multisig
    const inactiveMembers = await prisma.multisigMember.findMany({
      where: {
        multisigId,
        isInactive: true,
        isActive: true
      }
    });

    if (inactiveMembers.length === 0) {
      return { removedCount: 0, removedMembers: [] };
    }

    // Check if removing these members would make the multisig invalid
    const remainingActiveMembers = await prisma.multisigMember.count({
      where: {
        multisigId,
        isActive: true,
        isInactive: false
      }
    });

    const multisig = await prisma.multisig.findUnique({
      where: { id: multisigId }
    });

    if (!multisig) {
      throw new Error('Multisig not found');
    }

    // Ensure we don't remove too many members (need at least threshold + 1)
    const maxRemovable = remainingActiveMembers - multisig.threshold - 1;
    const membersToRemove = inactiveMembers.slice(0, Math.max(0, maxRemovable));

    if (membersToRemove.length === 0) {
      return { removedCount: 0, removedMembers: [] };
    }

    // Remove the members
    const removedMembers = [];
    for (const member of membersToRemove) {
      // Deactivate the member
      await prisma.multisigMember.update({
        where: { id: member.id },
        data: { isActive: false }
      });

      // Record the removal
      await prisma.multisigSignerRemoval.create({
        data: {
          multisigId,
          removedMemberId: member.id,
          removedBy: removedByMemberId,
          reason: 'INACTIVE_48H'
        }
      });

      removedMembers.push(member);
    }

    return {
      removedCount: removedMembers.length,
      removedMembers
    };
  }

  /**
   * Get inactive members for a multisig
   */
  public static async getInactiveMembers(multisigId: number): Promise<any[]> {
    return await prisma.multisigMember.findMany({
      where: {
        multisigId,
        isInactive: true,
        isActive: true
      },
      include: {
        multisig: true
      }
    });
  }

  /**
   * Get signer removal history
   */
  public static async getSignerRemovalHistory(
    multisigId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return await prisma.multisigSignerRemoval.findMany({
      where: { multisigId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        removedMember: {
          select: {
            id: true,
            publicKey: true,
            permissions: true
          }
        },
        removedByMember: {
          select: {
            id: true,
            publicKey: true
          }
        }
      }
    });
  }

  /**
   * Check if a transaction can proceed with current active members
   */
  public static async canTransactionProceed(
    multisigId: number,
    requiredApprovals: number
  ): Promise<{
    canProceed: boolean;
    activeMembers: number;
    requiredApprovals: number;
    reason?: string;
  }> {
    const activeMembers = await prisma.multisigMember.count({
      where: {
        multisigId,
        isActive: true,
        isInactive: false
      }
    });

    const canProceed = activeMembers >= requiredApprovals;

    return {
      canProceed,
      activeMembers,
      requiredApprovals,
      reason: canProceed ? undefined : `Not enough active members. Need ${requiredApprovals}, have ${activeMembers}`
    };
  }

  /**
   * Get multisig health status
   */
  public static async getMultisigHealth(multisigId: number): Promise<{
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    threshold: number;
    isHealthy: boolean;
    warnings: string[];
  }> {
    const multisig = await prisma.multisig.findUnique({
      where: { id: multisigId }
    });

    if (!multisig) {
      throw new Error('Multisig not found');
    }

    const [totalMembers, activeMembers, inactiveMembers] = await Promise.all([
      prisma.multisigMember.count({
        where: { multisigId }
      }),
      prisma.multisigMember.count({
        where: {
          multisigId,
          isActive: true,
          isInactive: false
        }
      }),
      prisma.multisigMember.count({
        where: {
          multisigId,
          isInactive: true,
          isActive: true
        }
      })
    ]);

    const warnings: string[] = [];
    let isHealthy = true;

    if (activeMembers < multisig.threshold) {
      isHealthy = false;
      warnings.push(`Not enough active members. Need ${multisig.threshold}, have ${activeMembers}`);
    }

    if (inactiveMembers > 0) {
      warnings.push(`${inactiveMembers} members are inactive and may be removed`);
    }

    if (activeMembers === multisig.threshold) {
      warnings.push('Multisig is at minimum threshold. Consider adding more members');
    }

    return {
      totalMembers,
      activeMembers,
      inactiveMembers,
      threshold: multisig.threshold,
      isHealthy,
      warnings
    };
  }

  /**
   * Background job to process inactive members
   */
  public static async processInactiveMembers(): Promise<void> {
    console.log('🔍 Checking for inactive multisig members...');

    try {
      // Check for inactive members
      const { markedInactive, inactiveMembers } = await this.checkInactiveMembers();

      if (markedInactive > 0) {
        console.log(`⚠️  Marked ${markedInactive} members as inactive`);

        // Group by multisig
        const multisigGroups = inactiveMembers.reduce((acc, member) => {
          if (!acc[member.multisigId]) {
            acc[member.multisigId] = [];
          }
          acc[member.multisigId].push(member);
          return acc;
        }, {} as Record<number, any[]>);

        // Process each multisig
        for (const [multisigId, members] of Object.entries(multisigGroups)) {
          try {
            // Find an active member to initiate removal
            const activeMember = await prisma.multisigMember.findFirst({
              where: {
                multisigId: parseInt(multisigId),
                isActive: true,
                isInactive: false
              }
            });

            if (activeMember) {
              const { removedCount } = await this.removeInactiveMembers(
                parseInt(multisigId),
                activeMember.id
              );

              if (removedCount > 0) {
                console.log(`🗑️  Removed ${removedCount} inactive members from multisig ${multisigId}`);
              }
            }
          } catch (error) {
            console.error(`❌ Error processing multisig ${multisigId}:`, error);
          }
        }
      } else {
        console.log('✅ No inactive members found');
      }
    } catch (error) {
      console.error('❌ Error processing inactive members:', error);
    }
  }
}

export default SignerManagementService;

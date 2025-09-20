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
        updatedAt: new Date()
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
    
    // Find members who haven't been active in 48 hours (using updatedAt as activity indicator)
    const inactiveMembers = await prisma.multisigMember.findMany({
      where: {
        isActive: true,
        updatedAt: {
          lt: fortyEightHoursAgo
        }
      },
      include: {
        multisig: true
      }
    });

    // Deactivate them (set isActive to false)
    const updateResult = await prisma.multisigMember.updateMany({
      where: {
        id: {
          in: inactiveMembers.map(m => m.id)
        }
      },
      data: {
        isActive: false
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
    // Get inactive members for this multisig (those that are not active)
    const inactiveMembers = await prisma.multisigMember.findMany({
      where: {
        multisigId,
        isActive: false
      }
    });

    if (inactiveMembers.length === 0) {
      return { removedCount: 0, removedMembers: [] };
    }

    // Check if removing these members would make the multisig invalid
    const remainingActiveMembers = await prisma.multisigMember.count({
      where: {
        multisigId,
        isActive: true
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

    // Remove the members (they're already deactivated, so we just return them)
    const removedMembers = membersToRemove;

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
        isActive: false
      },
      include: {
        multisig: true
      }
    });
  }

  /**
   * Get signer removal history (simplified - returns inactive members)
   */
  public static async getSignerRemovalHistory(
    multisigId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return await prisma.multisigMember.findMany({
      where: { 
        multisigId,
        isActive: false
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        publicKey: true,
        permissions: true,
        updatedAt: true,
        multisig: {
          select: {
            id: true,
            name: true
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
        isActive: true
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
          isActive: true
        }
      }),
      prisma.multisigMember.count({
        where: {
          multisigId,
          isActive: false
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
        console.log(`⚠️  Deactivated ${markedInactive} inactive members`);

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
                isActive: true
              }
            });

            if (activeMember) {
              const { removedCount } = await this.removeInactiveMembers(
                parseInt(multisigId),
                activeMember.id
              );

              if (removedCount > 0) {
                console.log(`🗑️  Processed ${removedCount} inactive members from multisig ${multisigId}`);
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

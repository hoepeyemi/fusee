import { prisma } from '../lib/prisma';
import { getMultisigService } from './multisigService';

export interface UserMultisigConfig {
  userId: number;
  name: string;
  threshold: number;
  timeLock?: number;
  members: Array<{
    publicKey: string;
    permissions: string[];
  }>;
}

export class UserMultisigService {
  public static async createUserMultisig(config: UserMultisigConfig) {
    const user = await prisma.user.findUnique({
      where: { id: config.userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.hasMultisig) {
      throw new Error('User already has multisig configured');
    }

    // Create multisig using the global service (for creation only)
    const multisigService = getMultisigService();
    
    // Generate a keypair for the multisig creator
    const { Keypair } = await import('@solana/web3.js');
    const creatorKeypair = Keypair.generate();
    
    const multisigResult = await multisigService.createMultisig(creatorKeypair);

    await prisma.user.update({
      where: { id: config.userId },
      data: {
        multisigPda: multisigResult.multisigPda,
        multisigCreateKey: multisigResult.createKey,
        multisigThreshold: config.threshold,
        multisigTimeLock: config.timeLock || 0,
        hasMultisig: true
      }
    });

    console.log(`🔐 Multisig created for user ${config.userId}:`);
    console.log(`   PDA: ${multisigResult.multisigPda}`);
    console.log(`   Transaction: ${multisigResult.transactionSignature}`);
    console.log(`   Initial Member (Creator): ${multisigResult.memberPublicKeys[0]}`);

    // Store the creator as the initial member
    await prisma.multisigMember.create({
      data: {
        userId: config.userId,
        publicKey: multisigResult.memberPublicKeys[0], // Creator's public key
        permissions: JSON.stringify(['propose', 'vote', 'execute']), // Full permissions for creator
        isActive: true
      }
    });

    // Store additional members from the config (they'll be added later via separate transactions)
    if (config.members && config.members.length > 0) {
      await Promise.all(
        config.members.map(member =>
          prisma.multisigMember.create({
            data: {
              userId: config.userId,
              publicKey: member.publicKey, // Use the provided public key
              permissions: JSON.stringify(member.permissions),
              isActive: true
            }
          })
        )
      );
    }

    return {
      multisigPda: multisigResult.multisigPda,
      createKey: multisigResult.createKey,
      threshold: config.threshold,
      timeLock: config.timeLock || 0,
      members: [
        {
          publicKey: multisigResult.memberPublicKeys[0],
          permissions: ['propose', 'vote', 'execute']
        },
        ...(config.members || [])
      ],
      transactionSignature: multisigResult.transactionSignature
    };
  }

  public static async getUserMultisig(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        multisigMembers: true
      }
    });

    if (!user) {
      return null;
    }

    return {
      multisigPda: user.multisigPda,
      createKey: user.multisigCreateKey,
      threshold: user.multisigThreshold,
      timeLock: user.multisigTimeLock,
      hasMultisig: user.hasMultisig,
      members: user.multisigMembers.map(member => ({
        id: member.id,
        publicKey: member.publicKey,
        permissions: JSON.parse(member.permissions),
        isActive: member.isActive
      }))
    };
  }

  public static async deleteUserMultisig(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.hasMultisig) {
      throw new Error('User does not have multisig configured');
    }

    await prisma.multisigMember.deleteMany({
      where: { userId: userId }
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        multisigPda: null,
        multisigCreateKey: null,
        multisigThreshold: null,
        multisigTimeLock: null,
        hasMultisig: false
      }
    });

    return true;
  }

  public static async hasUserMultisig(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hasMultisig: true }
    });

    return user?.hasMultisig || false;
  }

  public static async getUserMultisigPda(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { multisigPda: true }
    });

    return user?.multisigPda || null;
  }

  public static async updateUserMultisig(
    userId: number,
    updates: {
      threshold?: number;
      timeLock?: number;
      members?: Array<{
        publicKey: string;
        permissions: string[];
      }>;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.hasMultisig) {
      throw new Error('User does not have multisig configured');
    }

    // Update user's multisig settings
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.threshold !== undefined && { multisigThreshold: updates.threshold }),
        ...(updates.timeLock !== undefined && { multisigTimeLock: updates.timeLock })
      }
    });

    // Update members if provided
    if (updates.members) {
      // Delete existing members
      await prisma.multisigMember.deleteMany({
        where: { userId: userId }
      });

      // Create new members
      await Promise.all(
        updates.members.map(member =>
          prisma.multisigMember.create({
            data: {
              userId: userId,
              publicKey: member.publicKey,
              permissions: JSON.stringify(member.permissions),
              isActive: true
            }
          })
        )
      );
    }

    // Return updated configuration
    return this.getUserMultisig(userId);
  }
}

export default UserMultisigService;

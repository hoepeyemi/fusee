import { Keypair } from '@solana/web3.js';
import { prisma } from '../lib/prisma';
import { MultisigService } from './multisigService';
import { getMultisigConfig } from '../config/environment';

export interface OnDemandMultisigResult {
  multisigPda: string;
  createKey: string;
  transactionSignature: string;
  isNewMultisig: boolean;
}

export class OnDemandMultisigService {
  /**
   * Ensure user has a multisig account, create if needed
   */
  static async ensureUserMultisig(userId: number): Promise<OnDemandMultisigResult> {
    // Check if user already has multisig
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        hasMultisig: true,
        multisigPda: true,
        multisigCreateKey: true,
        multisigThreshold: true,
        multisigTimeLock: true
      }
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // If user already has multisig, return existing details
    if (user.hasMultisig && user.multisigPda && user.multisigCreateKey) {
      console.log(`✅ User ${userId} already has multisig: ${user.multisigPda}`);
      return {
        multisigPda: user.multisigPda,
        createKey: user.multisigCreateKey,
        transactionSignature: 'EXISTING_MULTISIG',
        isNewMultisig: false
      };
    }

    // User doesn't have multisig, create one on-demand
    console.log(`🔐 Creating on-demand multisig for user ${userId}...`);
    
    try {
      // Get multisig configuration
      const multisigConfig = getMultisigConfig();
      
      // Create multisig service
      const multisigService = new MultisigService({
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        threshold: multisigConfig.defaultThreshold,
        timeLock: multisigConfig.defaultTimeLock,
        members: []
      });

      // Generate a keypair for the multisig creator (user)
      const creatorKeypair = Keypair.generate();
      
      // Create the multisig
      const multisigResult = await multisigService.createMultisig(creatorKeypair);

      // Update user with multisig details
      await prisma.user.update({
        where: { id: userId },
        data: {
          multisigPda: multisigResult.multisigPda,
          multisigCreateKey: multisigResult.createKey,
          multisigThreshold: multisigConfig.defaultThreshold,
          multisigTimeLock: multisigConfig.defaultTimeLock,
          hasMultisig: true
        }
      });

      // Store the creator as the initial member
      await prisma.multisigMember.create({
        data: {
          userId: userId,
          publicKey: creatorKeypair.publicKey.toString(),
          permissions: JSON.stringify(['propose', 'vote', 'execute']),
          isActive: true
        }
      });

      // Add the configured admin members to this user's multisig
      await this.addAdminMembersToUserMultisig(userId, multisigResult.multisigPda);

      console.log(`✅ On-demand multisig created for user ${userId}:`);
      console.log(`   PDA: ${multisigResult.multisigPda}`);
      console.log(`   Transaction: ${multisigResult.transactionSignature}`);
      console.log(`   Creator: ${creatorKeypair.publicKey.toString()}`);

      return {
        multisigPda: multisigResult.multisigPda,
        createKey: multisigResult.createKey,
        transactionSignature: multisigResult.transactionSignature,
        isNewMultisig: true
      };

    } catch (error) {
      console.error(`❌ Failed to create on-demand multisig for user ${userId}:`, error);
      throw new Error(`Failed to create multisig for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Add admin members to user's multisig
   */
  private static async addAdminMembersToUserMultisig(userId: number, multisigPda: string): Promise<void> {
    try {
      const multisigConfig = getMultisigConfig();
      
      // Import Keypair and bs58 to derive public keys from private keys
      const { Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      
      // Derive public keys from private keys
      const member1Keypair = Keypair.fromSecretKey(bs58.default.decode(multisigConfig.member1PrivateKey));
      const member2Keypair = Keypair.fromSecretKey(bs58.default.decode(multisigConfig.member2PrivateKey));
      
      // Add member 1 (admin)
      await prisma.multisigMember.create({
        data: {
          userId: userId,
          publicKey: member1Keypair.publicKey.toString(),
          permissions: JSON.stringify(['propose', 'vote', 'execute']),
          isActive: true
        }
      });

      // Add member 2 (admin)
      await prisma.multisigMember.create({
        data: {
          userId: userId,
          publicKey: member2Keypair.publicKey.toString(),
          permissions: JSON.stringify(['propose', 'vote', 'execute']),
          isActive: true
        }
      });

      // Add member 3 (admin) if configured
      if (multisigConfig.member3PrivateKey) {
        const member3Keypair = Keypair.fromSecretKey(bs58.default.decode(multisigConfig.member3PrivateKey));
        await prisma.multisigMember.create({
          data: {
            userId: userId,
            publicKey: member3Keypair.publicKey.toString(),
            permissions: JSON.stringify(['propose', 'vote', 'execute']),
            isActive: true
          }
        });
      }

      console.log(`👥 Added admin members to user ${userId}'s multisig`);
    } catch (error) {
      console.error(`❌ Failed to add admin members to user ${userId}'s multisig:`, error);
      // Don't throw here, multisig creation was successful
    }
  }

  /**
   * Check if user needs multisig for a transaction
   */
  static async needsMultisigForTransaction(userId: number, transactionType: 'wallet' | 'external'): Promise<boolean> {
    // Both wallet transfers and external transfers require multisig
    return true;
  }

  /**
   * Get user's multisig details, create if needed
   */
  static async getUserMultisigDetails(userId: number): Promise<{
    multisigPda: string;
    createKey: string;
    threshold: number;
    timeLock: number;
    members: Array<{
      publicKey: string;
      permissions: string[];
    }>;
  }> {
    // Ensure user has multisig
    const multisigResult = await this.ensureUserMultisig(userId);

    // Get user's multisig configuration
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        multisigPda: true,
        multisigCreateKey: true,
        multisigThreshold: true,
        multisigTimeLock: true
      }
    });

    if (!user || !user.multisigPda || !user.multisigCreateKey) {
      throw new Error(`Multisig details not found for user ${userId}`);
    }

    // Get multisig members
    const members = await prisma.multisigMember.findMany({
      where: { userId: userId },
      select: {
        publicKey: true,
        permissions: true
      }
    });

    return {
      multisigPda: user.multisigPda,
      createKey: user.multisigCreateKey,
      threshold: user.multisigThreshold || 2,
      timeLock: user.multisigTimeLock || 0,
      members: members.map(member => ({
        publicKey: member.publicKey,
        permissions: JSON.parse(member.permissions)
      }))
    };
  }
}

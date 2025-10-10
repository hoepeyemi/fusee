import { Request, Response, NextFunction } from 'express';
import { SolanaBalanceService } from '../services/solanaBalanceService';

export interface BalanceSyncOptions {
  forceSync?: boolean;
  skipSync?: boolean;
  timeout?: number;
}

/**
 * Middleware to sync user balance from Solana blockchain
 */
export const syncUserBalance = (options: BalanceSyncOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip sync if explicitly disabled
      if (options.skipSync) {
        return next();
      }

      // Extract user ID from request
      let userId: number | null = null;

      // Try to get user ID from different sources
      if (req.params.id) {
        userId = parseInt(req.params.id);
      } else if (req.body.userId) {
        userId = parseInt(req.body.userId);
      } else if (req.query.userId) {
        userId = parseInt(req.query.userId as string);
      }

      // Skip if no user ID found
      if (!userId || isNaN(userId)) {
        return next();
      }

      // Check if we should force sync or if balance is stale
      const shouldSync = options.forceSync || await shouldSyncBalance(userId);

      if (shouldSync) {
        console.log(`🔄 Syncing balance for user ${userId} from Solana blockchain...`);
        
        // Set timeout for balance sync
        const timeout = options.timeout || 10000; // 10 seconds default
        
        const syncPromise = SolanaBalanceService.updateUserBalanceFromBlockchain(userId);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Balance sync timeout')), timeout)
        );

        try {
          const result = await Promise.race([syncPromise, timeoutPromise]) as any;
          
          if (result.success) {
            console.log(`✅ Balance synced for user ${userId}: ${result.newBalance} USDC`);
          } else {
            console.warn(`⚠️ Balance sync failed for user ${userId}: ${result.error}`);
          }
        } catch (syncError) {
          console.error(`❌ Balance sync error for user ${userId}:`, syncError);
          // Don't fail the request if balance sync fails
        }
      }

      next();
    } catch (error) {
      console.error('❌ Balance sync middleware error:', error);
      // Don't fail the request if middleware has issues
      next();
    }
  };
};

/**
 * Check if user balance should be synced
 */
async function shouldSyncBalance(userId: number): Promise<boolean> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        updatedAt: true,
        solanaWallet: true
      }
    });

    await prisma.$disconnect();

    if (!user || !user.solanaWallet) {
      return false;
    }

    // Sync if balance hasn't been updated in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return user.updatedAt < fiveMinutesAgo;
  } catch (error) {
    console.error('Error checking if balance should sync:', error);
    return false;
  }
}

/**
 * Middleware for specific user endpoints
 */
export const syncUserBalanceOnRequest = syncUserBalance({
  forceSync: false,
  timeout: 10000
});

/**
 * Middleware for force sync (admin endpoints)
 */
export const forceSyncUserBalance = syncUserBalance({
  forceSync: true,
  timeout: 15000
});

/**
 * Middleware for batch operations (skip sync to avoid performance issues)
 */
export const skipBalanceSync = syncUserBalance({
  skipSync: true
});




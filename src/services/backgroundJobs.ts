import { SignerManagementService } from './signerManagementService';
import { prisma } from '../lib/prisma';

export class BackgroundJobs {
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

  /**
   * Start all background jobs
   */
  public static start(): void {
    console.log('🚀 Starting background jobs...');
    
    // Only start background jobs if database is available
    this.checkDatabaseConnection()
      .then(() => {
        // Start inactive member check
        this.startInactiveMemberCheck();
        console.log('✅ Background jobs started');
      })
      .catch((error) => {
        console.warn('⚠️  Database not available, background jobs will not start:', error.message);
        console.log('🔄 Background jobs will retry when database becomes available');
      });
  }

  /**
   * Stop all background jobs
   */
  public static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Background jobs stopped');
    }
  }

  /**
   * Start the inactive member check job
   */
  private static startInactiveMemberCheck(): void {
    // Run immediately on startup
    this.checkInactiveMembers();

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.checkInactiveMembers();
    }, this.CHECK_INTERVAL);

    console.log('⏰ Inactive member check scheduled every hour');
  }

  /**
   * Check for inactive members
   */
  private static async checkInactiveMembers(): Promise<void> {
    try {
      // First check if database is available
      await this.checkDatabaseConnection();
      
      // Then process inactive members
      await SignerManagementService.processInactiveMembers();
    } catch (error) {
      console.error('❌ Error in inactive member check:', error);
      
      // If it's a database connection error, log it but don't crash
      if (error instanceof Error && error.message.includes('Can\'t reach database server')) {
        console.warn('⚠️  Database connection failed, skipping inactive member check');
        return;
      }
      
      // For other errors, re-throw to be handled by the caller
      throw error;
    }
  }

  /**
   * Check database connection
   */
  private static async checkDatabaseConnection(): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run a manual check (for testing)
   */
  public static async runManualCheck(): Promise<void> {
    console.log('🔍 Running manual inactive member check...');
    await this.checkInactiveMembers();
  }
}

export default BackgroundJobs;

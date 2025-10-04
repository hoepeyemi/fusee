import { SignerManagementService } from './signerManagementService';
import { adminInactivityService } from './adminInactivityService';

export class BackgroundJobs {
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

  /**
   * Start all background jobs
   */
  public static start(): void {
    console.log('🚀 Starting background jobs...');
    
    // Start inactive member check
    this.startInactiveMemberCheck();
    
    // Start admin inactivity monitoring
    this.startAdminInactivityMonitoring();
    
    console.log('✅ Background jobs started');
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
      await SignerManagementService.processInactiveMembers();
    } catch (error) {
      console.error('❌ Error in inactive member check:', error);
    }
  }

  /**
   * Start admin inactivity monitoring
   */
  private static startAdminInactivityMonitoring(): void {
    console.log('🔄 Starting admin inactivity monitoring...');
    adminInactivityService.startMonitoring();
  }

  /**
   * Run a manual check (for testing)
   */
  public static async runManualCheck(): Promise<void> {
    console.log('🔍 Running manual inactive member check...');
    await this.checkInactiveMembers();
  }

  /**
   * Run a manual admin inactivity check (for testing)
   */
  public static async runManualAdminCheck(): Promise<void> {
    console.log('🔍 Running manual admin inactivity check...');
    await adminInactivityService.checkInactiveAdmins();
  }
}

export default BackgroundJobs;

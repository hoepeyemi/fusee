import { Connection } from '@solana/web3.js';
import { BlockchainMonitorService } from './blockchainMonitorService';

export class BackgroundDepositMonitor {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static connection: Connection;

  /**
   * Initialize the background monitor
   */
  public static initialize(connection: Connection) {
    this.connection = connection;
    BlockchainMonitorService.initialize(connection);
    console.log('🔧 Background deposit monitor initialized');
  }

  /**
   * Start the background monitoring
   */
  public static start(): void {
    if (this.isRunning) {
      console.log('⚠️ Background deposit monitor is already running');
      return;
    }

    console.log('🚀 Starting background deposit monitoring...');
    this.isRunning = true;

    // Run immediately
    this.runMonitoringCycle();

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.runMonitoringCycle();
    }, this.MONITORING_INTERVAL);

    console.log(`✅ Background deposit monitor started (interval: ${this.MONITORING_INTERVAL / 1000}s)`);
  }

  /**
   * Stop the background monitoring
   */
  public static stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Background deposit monitor is not running');
      return;
    }

    console.log('🛑 Stopping background deposit monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Background deposit monitor stopped');
  }

  /**
   * Get monitoring status
   */
  public static getStatus(): {
    isRunning: boolean;
    interval: number;
    nextRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      interval: this.MONITORING_INTERVAL,
      nextRun: this.isRunning ? new Date(Date.now() + this.MONITORING_INTERVAL) : undefined
    };
  }

  /**
   * Run a single monitoring cycle
   */
  private static async runMonitoringCycle(): Promise<void> {
    try {
      console.log('🔍 Running blockchain deposit monitoring cycle...');
      
      const startTime = Date.now();
      
      // Monitor all user wallets
      const detectionResult = await BlockchainMonitorService.monitorUserWallets();
      
      // Process any new deposits found
      if (detectionResult.newDeposits.length > 0) {
        console.log(`💰 Processing ${detectionResult.newDeposits.length} new deposits...`);
        
        const processResult = await BlockchainMonitorService.processDetectedDeposits(
          detectionResult.newDeposits
        );
        
        console.log(`✅ Monitoring cycle complete:`);
        console.log(`   New deposits found: ${detectionResult.newDeposits.length}`);
        console.log(`   Deposits processed: ${processResult.processed}`);
        console.log(`   Errors: ${processResult.errors.length}`);
        
        if (processResult.errors.length > 0) {
          console.error('❌ Processing errors:', processResult.errors);
        }
      } else {
        console.log('✅ Monitoring cycle complete: No new deposits found');
      }
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ Monitoring cycle took ${duration}ms`);
      
    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error);
    }
  }

  /**
   * Force run a monitoring cycle (for manual triggers)
   */
  public static async forceRun(): Promise<{
    success: boolean;
    depositsFound: number;
    depositsProcessed: number;
    errors: string[];
  }> {
    try {
      console.log('🔄 Force running blockchain deposit monitoring...');
      
      const detectionResult = await BlockchainMonitorService.monitorUserWallets();
      let processResult = { processed: 0, errors: [] };
      
      if (detectionResult.newDeposits.length > 0) {
        processResult = await BlockchainMonitorService.processDetectedDeposits(
          detectionResult.newDeposits
        );
      }
      
      console.log(`✅ Force run complete: ${processResult.processed} deposits processed`);
      
      return {
        success: true,
        depositsFound: detectionResult.newDeposits.length,
        depositsProcessed: processResult.processed,
        errors: processResult.errors
      };
      
    } catch (error) {
      console.error('❌ Error in force run:', error);
      return {
        success: false,
        depositsFound: 0,
        depositsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Get monitoring statistics
   */
  public static async getStats(): Promise<{
    isRunning: boolean;
    interval: number;
    nextRun?: Date;
    monitoringStats: any;
  }> {
    const monitoringStats = await BlockchainMonitorService.getMonitoringStats();
    
    return {
      ...this.getStatus(),
      monitoringStats
    };
  }
}




import * as multisig from "@sqds/multisig";
import { Connection, Keypair, PublicKey, TransactionMessage, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../lib/prisma";
import { SignerManagementService } from "./signerManagementService";

export interface MultisigConfig {
  rpcUrl: string;
  multisigPda?: string;
  createKey?: string;
  threshold: number;
  timeLock?: number;
  members: Array<{
    publicKey: string;
    permissions: string[];
  }>;
}

export interface TransferRequest {
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency?: string;
  memo?: string;
}

export class MultisigService {
  private connection: Connection;
  private multisigPda?: PublicKey;
  private createKey?: PublicKey;
  private threshold: number;
  private timeLock: number;
  private members: Array<{ publicKey: string; permissions: string[] }>;

  constructor(config: MultisigConfig) {
    this.connection = new Connection(config.rpcUrl);
    this.threshold = config.threshold;
    this.timeLock = config.timeLock || 0;
    this.members = config.members;

    if (config.multisigPda) {
      this.multisigPda = new PublicKey(config.multisigPda);
    }
    if (config.createKey) {
      this.createKey = new PublicKey(config.createKey);
    }
  }

  /**
   * Create a new multisig account
   */
  async createMultisig(creator: Keypair): Promise<{
    multisigPda: string;
    createKey: string;
    transactionSignature: string;
    memberPublicKeys: string[];
  }> {
    // Import Keypair at the top of the method
    const { Keypair } = await import('@solana/web3.js');
    
    if (!this.createKey) {
      this.createKey = Keypair.generate().publicKey;
    }

    const [multisigPda] = multisig.getMultisigPda({
      createKey: this.createKey,
    });

    this.multisigPda = multisigPda;

    // Program config will be fetched in the instruction creation below

    // For multisig creation, we need at least 2 members
    // Let's create with creator + one specific additional member
    const { Permission, Permissions } = multisig.types;
    
    // Generate a new keypair for the additional member
    // We'll use the generated public key instead of trying to match a specific one
    const additionalMemberKeypair = Keypair.generate();
    
    console.log('🔍 Generated keypair for additional member:');
    console.log(`   Generated public key: ${additionalMemberKeypair.publicKey.toString()}`);
    console.log(`   This will be used as the second member of the multisig`);
    
    const members = [
      {
        key: creator.publicKey, // Creator is the first member
        permissions: this.convertPermissions(['propose', 'vote', 'execute']), // Full permissions for creator
      },
      {
        key: additionalMemberKeypair.publicKey, // Additional member
        permissions: this.convertPermissions(['vote']), // Basic voting permissions
      }
    ];
    
    // Set threshold to 1 (any one member can sign)
    const initialThreshold = 1;
    
    console.log('🔑 Creating multisig with 2 members:');
    console.log(`   Creator/Member 1: ${creator.publicKey.toString()}`);
    console.log(`   Additional Member 2: ${additionalMemberKeypair.publicKey.toString()}`);
    console.log(`   Threshold: ${initialThreshold} (any one member can sign)`);
    console.log(`   TimeLock: ${this.timeLock}`);

    // Use multisigCreateV2 as shown in the guide
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      this.connection,
      programConfigPda
    );
    const configTreasury = programConfig.treasury;

    // Use multisigCreateV2 instruction
    const instruction = await multisig.instructions.multisigCreateV2({
      createKey: this.createKey,
      creator: creator.publicKey,
      multisigPda,
      configAuthority: null,
      timeLock: this.timeLock,
      members,
      threshold: initialThreshold, // Use adjusted threshold
      treasury: configTreasury,
      rentCollector: null,
    });

    // Create and send the transaction
    const { Transaction, sendAndConfirmTransaction } = await import('@solana/web3.js');
    
    const transaction = new Transaction().add(instruction);
    
    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = creator.publicKey;
    
    console.log('📋 Transaction details:');
    console.log(`   Fee Payer: ${transaction.feePayer?.toString()}`);
    console.log(`   Instructions: ${transaction.instructions.length}`);
    console.log(`   Recent Blockhash: ${blockhash}`);

    // Sign and send the transaction
    console.log('🚀 Creating multisig on Solana blockchain...');
    
    try {
      // Test RPC connection first
      console.log('🔍 Testing RPC connection...');
      await this.connection.getLatestBlockhash();
      console.log('✅ RPC connection successful');

      // Check current balances and airdrop SOL to all signers
      console.log('💰 Checking signer balances and airdropping SOL...');
      const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      
      // Check creator balance
      const creatorBalance = await this.connection.getBalance(creator.publicKey);
      console.log(`🔍 Creator balance: ${creatorBalance / LAMPORTS_PER_SOL} SOL (${creatorBalance} lamports)`);
      console.log(`   Creator address: ${creator.publicKey.toString()}`);
      
      // Check additional member balance
      const additionalMemberBalance = await this.connection.getBalance(additionalMemberKeypair.publicKey);
      console.log(`🔍 Additional member balance: ${additionalMemberBalance / LAMPORTS_PER_SOL} SOL (${additionalMemberBalance} lamports)`);
      console.log(`   Additional member address: ${additionalMemberKeypair.publicKey.toString()}`);
      
      // Airdrop to creator if balance is low
      if (creatorBalance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('💰 Creator has insufficient SOL, requesting airdrop...');
        try {
          const airdropSignature = await this.connection.requestAirdrop(creator.publicKey, 2 * LAMPORTS_PER_SOL);
          console.log(`✅ Airdrop transaction sent for creator: ${airdropSignature}`);
          
          // Wait for confirmation with retries
          let confirmed = false;
          let retries = 0;
          const maxRetries = 10;
          
          while (!confirmed && retries < maxRetries) {
            try {
              const confirmation = await this.connection.confirmTransaction(airdropSignature, 'confirmed');
              if (confirmation.value.err) {
                console.log(`⚠️ Airdrop confirmation error (retry ${retries + 1}):`, confirmation.value.err);
                retries++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                continue;
              }
              confirmed = true;
              console.log(`✅ Airdrop confirmed for creator after ${retries + 1} attempts`);
            } catch (e) {
              console.log(`⚠️ Airdrop confirmation failed (retry ${retries + 1}):`, e);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
          }
          
          if (!confirmed) {
            throw new Error(`Failed to confirm airdrop for creator after ${maxRetries} attempts`);
          }
          
          // Wait a bit more for the balance to update
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newCreatorBalance = await this.connection.getBalance(creator.publicKey);
          console.log(`✅ Creator new balance: ${newCreatorBalance / LAMPORTS_PER_SOL} SOL (${newCreatorBalance} lamports)`);
        } catch (e) {
          console.log('❌ Airdrop to creator failed:', e);
          throw new Error(`Failed to airdrop SOL to creator ${creator.publicKey.toString()}: ${e}`);
        }
      } else {
        console.log('✅ Creator has sufficient SOL');
      }

      // Airdrop to additional member if balance is low
      if (additionalMemberBalance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('💰 Additional member has insufficient SOL, requesting airdrop...');
        try {
          const airdropSignature = await this.connection.requestAirdrop(additionalMemberKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
          console.log(`✅ Airdrop transaction sent for additional member: ${airdropSignature}`);
          
          // Wait for confirmation with retries
          let confirmed = false;
          let retries = 0;
          const maxRetries = 10;
          
          while (!confirmed && retries < maxRetries) {
            try {
              const confirmation = await this.connection.confirmTransaction(airdropSignature, 'confirmed');
              if (confirmation.value.err) {
                console.log(`⚠️ Airdrop confirmation error (retry ${retries + 1}):`, confirmation.value.err);
                retries++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                continue;
              }
              confirmed = true;
              console.log(`✅ Airdrop confirmed for additional member after ${retries + 1} attempts`);
            } catch (e) {
              console.log(`⚠️ Airdrop confirmation failed (retry ${retries + 1}):`, e);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
          }
          
          if (!confirmed) {
            throw new Error(`Failed to confirm airdrop for additional member after ${maxRetries} attempts`);
          }
          
          // Wait a bit more for the balance to update
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newAdditionalMemberBalance = await this.connection.getBalance(additionalMemberKeypair.publicKey);
          console.log(`✅ Additional member new balance: ${newAdditionalMemberBalance / LAMPORTS_PER_SOL} SOL (${newAdditionalMemberBalance} lamports)`);
        } catch (e) {
          console.log('❌ Airdrop to additional member failed:', e);
          throw new Error(`Failed to airdrop SOL to additional member ${additionalMemberKeypair.publicKey.toString()}: ${e}`);
        }
      } else {
        console.log('✅ Additional member has sufficient SOL');
      }

      // Final balance check before proceeding with retries
      console.log('📊 Performing final balance check...');
      let finalCreatorBalance = await this.connection.getBalance(creator.publicKey);
      let finalAdditionalMemberBalance = await this.connection.getBalance(additionalMemberKeypair.publicKey);
      
      // If balances are still low, wait and retry a few times
      let balanceRetries = 0;
      const maxBalanceRetries = 5;
      
      while ((finalCreatorBalance < 0.01 * LAMPORTS_PER_SOL || finalAdditionalMemberBalance < 0.01 * LAMPORTS_PER_SOL) && balanceRetries < maxBalanceRetries) {
        console.log(`⚠️ Low balances detected (retry ${balanceRetries + 1}/${maxBalanceRetries}):`);
        console.log(`   Creator: ${finalCreatorBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`   Additional Member: ${finalAdditionalMemberBalance / LAMPORTS_PER_SOL} SOL`);
        
        console.log('⏳ Waiting for balance updates...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        finalCreatorBalance = await this.connection.getBalance(creator.publicKey);
        finalAdditionalMemberBalance = await this.connection.getBalance(additionalMemberKeypair.publicKey);
        balanceRetries++;
      }
      
      console.log('📊 Final balances before multisig creation:');
      console.log(`   Creator: ${finalCreatorBalance / LAMPORTS_PER_SOL} SOL (${finalCreatorBalance} lamports)`);
      console.log(`   Additional Member: ${finalAdditionalMemberBalance / LAMPORTS_PER_SOL} SOL (${finalAdditionalMemberBalance} lamports)`);
      
      if (finalCreatorBalance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(`Creator ${creator.publicKey.toString()} has insufficient SOL: ${finalCreatorBalance / LAMPORTS_PER_SOL} SOL. Please check Solana Explorer: https://explorer.solana.com/address/${creator.publicKey.toString()}`);
      }
      
      if (finalAdditionalMemberBalance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(`Additional member ${additionalMemberKeypair.publicKey.toString()} has insufficient SOL: ${finalAdditionalMemberBalance / LAMPORTS_PER_SOL} SOL. Please check Solana Explorer: https://explorer.solana.com/address/${additionalMemberKeypair.publicKey.toString()}`);
      }

      // Both members need to sign the multisig creation transaction
      // Even with multisigCreate, all members must sign
      const allSigners = [creator, additionalMemberKeypair];
      console.log(`🔐 Signing transaction with ${allSigners.length} signers (creator + additional member)`);
      console.log('📝 Note: All members must sign the multisig creation transaction');
      
      // Use sendAndConfirmTransaction with both signers
      let signature: string;
      try {
        signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          allSigners,
          {
            commitment: 'confirmed',
            skipPreflight: false,
          }
        );
      } catch (error: any) {
        console.error('❌ Transaction failed:', error);
        
        // If it's a SendTransactionError, get the full logs
        if (error.name === 'SendTransactionError' && error.logs) {
          console.error('📋 Transaction logs:', error.logs);
        }
        
        // Check if it's a simulation error
        if (error.message && error.message.includes('Simulation failed')) {
          console.error('🔍 Simulation failed. This usually means:');
          console.error('   1. One or more accounts have insufficient SOL');
          console.error('   2. The transaction would fail on-chain');
          console.error('   3. Account validation failed');
          
          // Show current balances again
          const creatorBalance = await this.connection.getBalance(creator.publicKey);
          const additionalMemberBalance = await this.connection.getBalance(additionalMemberKeypair.publicKey);
          console.error('💰 Current balances:');
          console.error(`   Creator: ${creatorBalance / LAMPORTS_PER_SOL} SOL`);
          console.error(`   Additional Member: ${additionalMemberBalance / LAMPORTS_PER_SOL} SOL`);
        }
        
        throw error;
      }

      console.log(`✅ Multisig created successfully! Signature: ${signature}`);
      
      return {
        multisigPda: multisigPda.toString(),
        createKey: this.createKey.toString(),
        transactionSignature: signature,
        memberPublicKeys: [
          creator.publicKey.toString(),
          additionalMemberKeypair.publicKey.toString()
        ], // Creator + additional member
      };
    } catch (error) {
      console.error('Error creating multisig:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // Handle different types of errors
      if (error.message && error.message.includes('fetch failed')) {
        throw new Error(`RPC connection failed. Please check your internet connection and RPC URL. Current RPC: ${this.connection.rpcEndpoint}`);
      }
      
      if (error.message && error.message.includes('Missing signature')) {
        throw new Error('Multisig creation failed due to signature requirements. The multisig is created with the creator as the initial member.');
      }
      
      if (error.message && error.message.includes('failed to get info about account')) {
        throw new Error('Failed to fetch account information from Solana RPC. The RPC endpoint may be down or the account may not exist.');
      }
      
      if (error.message && error.message.includes('unknown signer')) {
        throw new Error('Transaction signing failed. This may be due to incorrect signer configuration in the multisig instruction.');
      }
      
      throw error;
    }
  }

  /**
   * Create a vault transaction for external transfers
   */
  async createVaultTransaction(
    fromWallet: string,
    toWallet: string,
    amount: number,
    memo?: string
  ): Promise<{
    transactionIndex: bigint;
    instruction: any;
  }> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    // Get multisig info
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      this.connection,
      this.multisigPda
    );

    const currentTransactionIndex = Number(multisigInfo.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);

    // Derive vault PDA
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: this.multisigPda,
      index: 0,
    });

    // Create transfer instruction using SystemProgram
    const { SystemProgram } = await import('@solana/web3.js');
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: new PublicKey(fromWallet),
      toPubkey: new PublicKey(toWallet),
      lamports: BigInt(amount * LAMPORTS_PER_SOL),
    });

    // Build transaction message
    const transactionMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [transferInstruction],
    });

    const instruction = await multisig.instructions.vaultTransactionCreate({
      multisigPda: this.multisigPda,
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(this.members[0].publicKey), // First member as creator
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage,
      memo: memo || "External transfer via multisig",
    });

    return {
      transactionIndex: newTransactionIndex,
      instruction,
    };
  }

  /**
   * Create a proposal for a transaction
   */
  async createProposal(
    transactionIndex: bigint,
    proposerKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    // Update member activity
    const multisigData = await prisma.multisig.findUnique({
      where: { multisigPda: this.multisigPda.toString() }
    });

    if (multisigData) {
      await SignerManagementService.updateMemberActivity(multisigData.id, proposerKey);
    }

    const instruction = await multisig.instructions.proposalCreate({
      multisigPda: this.multisigPda,
      transactionIndex,
      creator: new PublicKey(proposerKey),
    });

    return instruction;
  }

  /**
   * Approve a proposal
   */
  async approveProposal(
    transactionIndex: bigint,
    memberKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    // Update member activity
    const multisigData = await prisma.multisig.findUnique({
      where: { multisigPda: this.multisigPda.toString() }
    });

    if (multisigData) {
      await SignerManagementService.updateMemberActivity(multisigData.id, memberKey);
    }

    const instruction = await multisig.instructions.proposalApprove({
      multisigPda: this.multisigPda,
      transactionIndex,
      member: new PublicKey(memberKey),
    });

    return instruction;
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(
    transactionIndex: bigint,
    memberKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    const instruction = await multisig.instructions.proposalReject({
      multisigPda: this.multisigPda,
      transactionIndex,
      member: new PublicKey(memberKey),
    });

    return instruction;
  }

  /**
   * Execute a vault transaction
   */
  async executeVaultTransaction(
    transactionIndex: bigint,
    executorKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    const instruction = await multisig.instructions.vaultTransactionExecute({
      connection: this.connection,
      multisigPda: this.multisigPda,
      transactionIndex,
      member: new PublicKey(executorKey),
    });

    return instruction;
  }

  /**
   * Get multisig information
   */
  async getMultisigInfo(): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    return await multisig.accounts.Multisig.fromAccountAddress(
      this.connection,
      this.multisigPda
    );
  }

  /**
   * Check if a transaction is approved
   */
  async isTransactionApproved(transactionIndex: bigint): Promise<boolean> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    try {
      const [proposalPda] = multisig.getProposalPda({
        multisigPda: this.multisigPda,
        transactionIndex,
      });

      const proposal = await multisig.accounts.Proposal.fromAccountAddress(
        this.connection,
        proposalPda
      );

      // Check if proposal is approved (status 1)
      return (proposal.status as any) === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert permission strings to Squads permissions
   */
  private convertPermissions(permissions: string[]): any {
    const { Permission, Permissions } = multisig.types;
    
    if (permissions.includes("all")) {
      return Permissions.all();
    }

    const permissionList = permissions.map(perm => {
      switch (perm.toLowerCase()) {
        case "propose":
          return Permission.Initiate;
        case "vote":
          return Permission.Vote;
        case "execute":
          return Permission.Execute;
        default:
          throw new Error(`Unknown permission: ${perm}`);
      }
    });

    return Permissions.fromPermissions(permissionList);
  }

  /**
   * Save multisig to database
   */
  async saveMultisigToDatabase(
    multisigPda: string,
    createKey: string,
    name: string = "Main Multisig"
  ): Promise<any> {
    return await prisma.multisig.create({
      data: {
        multisigPda,
        createKey,
        name,
        threshold: this.threshold,
        timeLock: this.timeLock,
        members: {
          create: this.members.map(member => ({
            publicKey: member.publicKey,
            permissions: JSON.stringify(member.permissions),
          })),
        },
      },
      include: {
        members: true,
      },
    });
  }

  /**
   * Save multisig transaction to database
   */
  async saveTransactionToDatabase(
    multisigId: number,
    transactionIndex: bigint,
    fromWallet: string,
    toWallet: string,
    amount: number,
    currency: string = "SOL",
    memo?: string
  ): Promise<any> {
    return await prisma.multisigTransaction.create({
      data: {
        multisigId,
        transactionIndex,
        fromWallet,
        toWallet,
        amount,
        currency,
        memo,
      },
    });
  }

  /**
   * Save proposal to database
   */
  async saveProposalToDatabase(
    multisigTransactionId: number,
    proposerKey: string
  ): Promise<any> {
    return await prisma.multisigProposal.create({
      data: {
        multisigTransactionId,
        proposerKey,
      },
    });
  }

  /**
   * Save approval to database
   */
  async saveApprovalToDatabase(
    multisigTransactionId: number,
    memberId: number,
    approvalType: "APPROVE" | "REJECT"
  ): Promise<any> {
    return await prisma.multisigApproval.create({
      data: {
        multisigTransactionId,
        memberId,
        approvalType,
      },
    });
  }

  /**
   * Get multisig from database
   */
  async getMultisigFromDatabase(multisigPda: string): Promise<any> {
    return await prisma.multisig.findUnique({
      where: { multisigPda },
      include: {
        members: true,
        transactions: {
          include: {
            proposals: true,
            approvals: {
              include: {
                member: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionIndex: bigint,
    status: "PENDING" | "PROPOSED" | "APPROVED" | "EXECUTED" | "REJECTED" | "CANCELLED" | "FAILED"
  ): Promise<any> {
    return await prisma.multisigTransaction.updateMany({
      where: { transactionIndex },
      data: { status },
    });
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(
    multisigTransactionId: number,
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "STALE"
  ): Promise<any> {
    return await prisma.multisigProposal.updateMany({
      where: { multisigTransactionId },
      data: { status },
    });
  }
}

// Singleton instance
let multisigServiceInstance: MultisigService | null = null;

export function getMultisigService(): MultisigService {
  if (!multisigServiceInstance) {
    // Try multiple RPC URLs for better reliability
    const rpcUrls = [
      process.env.SOLANA_RPC_URL,
      "https://api.devnet.solana.com", // Devnet (more reliable for testing)
      "https://api.mainnet-beta.solana.com", // Mainnet
      "https://solana-api.projectserum.com", // Alternative mainnet
    ].filter(Boolean);

    const config: MultisigConfig = {
      rpcUrl: rpcUrls[0] || "https://api.devnet.solana.com",
      // Default values for multisig creation (not used for specific user operations)
      threshold: 2,
      members: []
    };
    
    console.log(`🔗 Using Solana RPC: ${config.rpcUrl}`);
    multisigServiceInstance = new MultisigService(config);
  }
  return multisigServiceInstance;
}

// New function to create multisig service with user-specific configuration
export function createUserMultisigService(userMultisigConfig: {
  multisigPda: string;
  createKey: string;
  threshold: number;
  timeLock: number;
  members: Array<{ publicKey: string; permissions: string[] }>;
}): MultisigService {
  // Use the same RPC URL selection logic
  const rpcUrls = [
    process.env.SOLANA_RPC_URL,
    "https://api.devnet.solana.com", // Devnet (more reliable for testing)
    "https://api.mainnet-beta.solana.com", // Mainnet
    "https://solana-api.projectserum.com", // Alternative mainnet
  ].filter(Boolean);

  const config: MultisigConfig = {
    rpcUrl: rpcUrls[0] || "https://api.devnet.solana.com",
    multisigPda: userMultisigConfig.multisigPda,
    createKey: userMultisigConfig.createKey,
    threshold: userMultisigConfig.threshold,
    timeLock: userMultisigConfig.timeLock,
    members: userMultisigConfig.members,
  };
  
  console.log(`🔗 Using Solana RPC for user multisig: ${config.rpcUrl}`);
  return new MultisigService(config);
}

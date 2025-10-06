import * as multisig from "@sqds/multisig";
import { Connection, Keypair, PublicKey, TransactionMessage, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../lib/prisma";
import { SignerManagementService } from "./signerManagementService";
import { getMultisigConfig, validatePrivateKeys } from "../config/environment";
import { adminInactivityService } from "./adminInactivityService";

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
  private createKeypair?: Keypair;
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
    // Import Keypair and bs58 at the top of the method
    const { Keypair } = await import('@solana/web3.js');
    const bs58 = await import('bs58');
    
    if (!this.createKey) {
      // Generate a keypair for the createKey, not just a public key
      const createKeypair = Keypair.generate();
      this.createKey = createKeypair.publicKey;
      // Store the keypair for signing
      this.createKeypair = createKeypair;
    }

    const [multisigPda] = multisig.getMultisigPda({
      createKey: this.createKey,
    });

    this.multisigPda = multisigPda;

    // Program config will be fetched in the instruction creation below

    // For multisig creation, we need at least 2 members
    // Use the configured private keys from environment variables
    const { Permission, Permissions } = multisig.types;
    
    // Load multisig configuration from environment variables
    const multisigConfig = getMultisigConfig();
    
    // Validate the private keys
    if (!validatePrivateKeys(multisigConfig)) {
      throw new Error('Invalid multisig member private keys in configuration');
    }
    
    // Create keypairs from the configured private keys
    const member1Keypair = Keypair.fromSecretKey(bs58.default.decode(multisigConfig.member1PrivateKey));
    const member2Keypair = Keypair.fromSecretKey(bs58.default.decode(multisigConfig.member2PrivateKey));
    
    console.log('🔍 Using configured private keys for multisig members:');
    console.log(`   Member 1 public key: ${member1Keypair.publicKey.toString()}`);
    console.log(`   Member 2 public key: ${member2Keypair.publicKey.toString()}`);
    
    // Add third member if provided
    let member3Keypair: Keypair | null = null;
    if (multisigConfig.member3PrivateKey) {
      member3Keypair = Keypair.fromSecretKey(bs58.default.decode(multisigConfig.member3PrivateKey));
      console.log(`   Member 3 public key: ${member3Keypair.publicKey.toString()}`);
    }
    
    const memberCount = 2 + (member3Keypair ? 1 : 0);
    console.log(`   Total members: ${memberCount} (Min: ${multisigConfig.minMembers}, Max: ${multisigConfig.maxMembers})`);
    console.log(`   Source: Environment variables (MULTISIG_MEMBER_1_PRIVATE_KEY, MULTISIG_MEMBER_2_PRIVATE_KEY${member3Keypair ? ', MULTISIG_MEMBER_3_PRIVATE_KEY' : ''})`);
    console.log(`   These will be used as the ${memberCount} members of the multisig`);
    
    const members = [
      {
        key: member1Keypair.publicKey, // First member from private key
        permissions: this.convertPermissions(['propose', 'vote', 'execute']), // Full admin permissions for member 1
      },
      {
        key: member2Keypair.publicKey, // Second member from private key
        permissions: this.convertPermissions(['propose', 'vote', 'execute']), // Full admin permissions for member 2
      }
    ];
    
    // Add third member if provided
    if (member3Keypair) {
      members.push({
        key: member3Keypair.publicKey, // Third member from private key
        permissions: this.convertPermissions(['propose', 'vote', 'execute']), // Full admin permissions for member 3
      });
    }
    
    // Set threshold to require all members to approve (but any one can execute)
    // If defaultThreshold is 0, use member count (all must approve)
    // Otherwise, use the configured threshold
    const initialThreshold = multisigConfig.defaultThreshold === 0 ? memberCount : multisigConfig.defaultThreshold;
    
    console.log(`🔑 Creating multisig with ${memberCount} members:`);
    console.log(`   Creator/Member 1: ${member1Keypair.publicKey.toString()}`);
    console.log(`   Member 2: ${member2Keypair.publicKey.toString()}`);
    if (member3Keypair) {
      console.log(`   Member 3: ${member3Keypair.publicKey.toString()}`);
    }
    console.log(`   Threshold: ${initialThreshold} (all ${memberCount} members must approve)`);
    console.log(`   Execution: Any one member can execute after approval`);
    console.log(`   TimeLock: ${multisigConfig.defaultTimeLock}`);

    // Use multisigCreateV2 as shown in the guide
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      this.connection,
      programConfigPda
    );
    const configTreasury = programConfig.treasury;

    // Use multisigCreateV2 instruction
    // Use member1Keypair as the creator since we're using provided private keys
    const instruction = await multisig.instructions.multisigCreateV2({
      createKey: this.createKey,
      creator: member1Keypair.publicKey, // Use member1 as creator
      multisigPda,
      configAuthority: null,
      timeLock: multisigConfig.defaultTimeLock,
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
    transaction.feePayer = member1Keypair.publicKey; // Use member 1 as fee payer (matches creator)
    
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
      
      // Check member 1 balance
      const member1Balance = await this.connection.getBalance(member1Keypair.publicKey);
      console.log(`🔍 Member 1 balance: ${member1Balance / LAMPORTS_PER_SOL} SOL (${member1Balance} lamports)`);
      console.log(`   Member 1 address: ${member1Keypair.publicKey.toString()}`);
      
      // Check member 2 balance
      const member2Balance = await this.connection.getBalance(member2Keypair.publicKey);
      console.log(`🔍 Member 2 balance: ${member2Balance / LAMPORTS_PER_SOL} SOL (${member2Balance} lamports)`);
      console.log(`   Member 2 address: ${member2Keypair.publicKey.toString()}`);
      
      // Check createKey balance
      const createKeyBalance = await this.connection.getBalance(this.createKeypair!.publicKey);
      console.log(`🔍 CreateKey balance: ${createKeyBalance / LAMPORTS_PER_SOL} SOL (${createKeyBalance} lamports)`);
      console.log(`   CreateKey address: ${this.createKeypair!.publicKey.toString()}`);
      
      // Airdrop to member 1 if balance is low
      if (member1Balance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('💰 Member 1 has insufficient SOL, requesting airdrop...');
        try {
          const airdropSignature = await this.connection.requestAirdrop(member1Keypair.publicKey, 2 * LAMPORTS_PER_SOL);
          console.log(`✅ Airdrop transaction sent for member 1: ${airdropSignature}`);
          
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
              console.log(`✅ Airdrop confirmed for member 1 after ${retries + 1} attempts`);
            } catch (e) {
              console.log(`⚠️ Airdrop confirmation failed (retry ${retries + 1}):`, e);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
          }
          
          if (!confirmed) {
            throw new Error(`Failed to confirm airdrop for member 1 after ${maxRetries} attempts`);
          }
          
          // Wait a bit more for the balance to update
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newMember1Balance = await this.connection.getBalance(member1Keypair.publicKey);
          console.log(`✅ Member 1 new balance: ${newMember1Balance / LAMPORTS_PER_SOL} SOL (${newMember1Balance} lamports)`);
        } catch (e) {
          console.log('❌ Airdrop to member 1 failed:', e);
          throw new Error(`Failed to airdrop SOL to member 1 ${member1Keypair.publicKey.toString()}: ${e}`);
        }
      } else {
        console.log('✅ Member 1 has sufficient SOL');
      }

      // Airdrop to member 2 if balance is low
      if (member2Balance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('💰 Member 2 has insufficient SOL, requesting airdrop...');
        try {
          const airdropSignature = await this.connection.requestAirdrop(member2Keypair.publicKey, 2 * LAMPORTS_PER_SOL);
          console.log(`✅ Airdrop transaction sent for member 2: ${airdropSignature}`);
          
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
              console.log(`✅ Airdrop confirmed for member 2 after ${retries + 1} attempts`);
            } catch (e) {
              console.log(`⚠️ Airdrop confirmation failed (retry ${retries + 1}):`, e);
              retries++;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
          }
          
          if (!confirmed) {
            throw new Error(`Failed to confirm airdrop for member 2 after ${maxRetries} attempts`);
          }
          
          // Wait a bit more for the balance to update
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newMember2Balance = await this.connection.getBalance(member2Keypair.publicKey);
          console.log(`✅ Member 2 new balance: ${newMember2Balance / LAMPORTS_PER_SOL} SOL (${newMember2Balance} lamports)`);
        } catch (e) {
          console.log('❌ Airdrop to member 2 failed:', e);
          throw new Error(`Failed to airdrop SOL to member 2 ${member2Keypair.publicKey.toString()}: ${e}`);
        }
      } else {
        console.log('✅ Member 2 has sufficient SOL');
      }

      // Check member 3 balance if provided
      if (member3Keypair) {
        const member3Balance = await this.connection.getBalance(member3Keypair.publicKey);
        console.log(`🔍 Member 3 balance: ${member3Balance / LAMPORTS_PER_SOL} SOL (${member3Balance} lamports)`);
        console.log(`   Member 3 address: ${member3Keypair.publicKey.toString()}`);
        
        // Airdrop to member 3 if balance is low
        if (member3Balance < 0.1 * LAMPORTS_PER_SOL) {
          console.log('💰 Member 3 has insufficient SOL, requesting airdrop...');
          try {
            const airdropSignature = await this.connection.requestAirdrop(member3Keypair.publicKey, 2 * LAMPORTS_PER_SOL);
            console.log(`✅ Airdrop transaction sent for member 3: ${airdropSignature}`);
            
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
                console.log(`✅ Airdrop confirmed for member 3 after ${retries + 1} attempts`);
              } catch (e) {
                console.log(`⚠️ Airdrop confirmation failed (retry ${retries + 1}):`, e);
                retries++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              }
            }
            
            if (!confirmed) {
              throw new Error(`Failed to confirm airdrop for member 3 after ${maxRetries} attempts`);
            }
            
            // Wait a bit more for the balance to update
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const newMember3Balance = await this.connection.getBalance(member3Keypair.publicKey);
            console.log(`✅ Member 3 new balance: ${newMember3Balance / LAMPORTS_PER_SOL} SOL (${newMember3Balance} lamports)`);
          } catch (e) {
            console.log('❌ Airdrop to member 3 failed:', e);
            throw new Error(`Failed to airdrop SOL to member 3 ${member3Keypair.publicKey.toString()}: ${e}`);
          }
        } else {
          console.log('✅ Member 3 has sufficient SOL');
        }
      }

      // Airdrop to createKey if balance is low
      if (createKeyBalance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('💰 CreateKey has insufficient SOL, requesting airdrop...');
        console.log(`   CreateKey address: ${this.createKeypair!.publicKey.toString()}`);
        
        let airdropSuccess = false;
        let airdropRetries = 0;
        const maxAirdropRetries = 3;
        
        while (!airdropSuccess && airdropRetries < maxAirdropRetries) {
          try {
            console.log(`🔄 Airdrop attempt ${airdropRetries + 1}/${maxAirdropRetries}...`);
            
            // Try smaller airdrop amounts first
            const airdropAmount = airdropRetries === 0 ? 1 * LAMPORTS_PER_SOL : 2 * LAMPORTS_PER_SOL;
            const airdropSignature = await this.connection.requestAirdrop(this.createKeypair!.publicKey, airdropAmount);
            console.log(`✅ Airdrop transaction sent for createKey: ${airdropSignature}`);
            
            // Wait for confirmation with retries
            let confirmed = false;
            let confirmationRetries = 0;
            const maxConfirmationRetries = 5;
            
            while (!confirmed && confirmationRetries < maxConfirmationRetries) {
              try {
                const confirmation = await this.connection.confirmTransaction(airdropSignature, 'confirmed');
                if (confirmation.value.err) {
                  console.log(`⚠️ Airdrop confirmation error (retry ${confirmationRetries + 1}):`, confirmation.value.err);
                  confirmationRetries++;
                  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                  continue;
                }
                confirmed = true;
                console.log(`✅ Airdrop confirmed for createKey after ${confirmationRetries + 1} attempts`);
              } catch (e) {
                console.log(`⚠️ Airdrop confirmation failed (retry ${confirmationRetries + 1}):`, e);
                confirmationRetries++;
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
              }
            }
            
            if (confirmed) {
              // Wait a bit more for the balance to update
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const newCreateKeyBalance = await this.connection.getBalance(this.createKeypair!.publicKey);
              console.log(`✅ CreateKey new balance: ${newCreateKeyBalance / LAMPORTS_PER_SOL} SOL (${newCreateKeyBalance} lamports)`);
              
              if (newCreateKeyBalance >= 0.01 * LAMPORTS_PER_SOL) {
                airdropSuccess = true;
              } else {
                console.log(`⚠️ Airdrop completed but balance still low: ${newCreateKeyBalance / LAMPORTS_PER_SOL} SOL`);
                airdropRetries++;
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
              }
            } else {
              console.log(`❌ Airdrop confirmation failed after ${maxConfirmationRetries} attempts`);
              airdropRetries++;
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            }
          } catch (e) {
            console.log(`❌ Airdrop attempt ${airdropRetries + 1} failed:`, e.message);
            airdropRetries++;
            
            if (airdropRetries < maxAirdropRetries) {
              console.log(`⏳ Waiting 10 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before retry
            }
          }
        }
        
        if (!airdropSuccess) {
          console.log('⚠️ All airdrop attempts failed. Trying alternative approach...');
          
          // Alternative: Transfer SOL from member1 to createKey
          try {
            console.log('💸 Transferring SOL from Member 1 to CreateKey...');
            const { SystemProgram, Transaction, sendAndConfirmTransaction } = await import('@solana/web3.js');
            
            const transferAmount = 0.1 * LAMPORTS_PER_SOL; // Transfer 0.1 SOL
            const transferInstruction = SystemProgram.transfer({
              fromPubkey: member1Keypair.publicKey,
              toPubkey: this.createKeypair!.publicKey,
              lamports: transferAmount,
            });
            
            const transferTransaction = new Transaction().add(transferInstruction);
            const { blockhash } = await this.connection.getLatestBlockhash();
            transferTransaction.recentBlockhash = blockhash;
            transferTransaction.feePayer = member1Keypair.publicKey;
            
            const transferSignature = await sendAndConfirmTransaction(
              this.connection,
              transferTransaction,
              [member1Keypair],
              { commitment: 'confirmed' }
            );
            
            console.log(`✅ SOL transfer successful: ${transferSignature}`);
            
            // Wait for balance to update
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const finalCreateKeyBalance = await this.connection.getBalance(this.createKeypair!.publicKey);
            console.log(`✅ CreateKey final balance: ${finalCreateKeyBalance / LAMPORTS_PER_SOL} SOL (${finalCreateKeyBalance} lamports)`);
            
            if (finalCreateKeyBalance < 0.01 * LAMPORTS_PER_SOL) {
              throw new Error(`CreateKey still has insufficient SOL after transfer: ${finalCreateKeyBalance / LAMPORTS_PER_SOL} SOL`);
            }
          } catch (transferError) {
            console.log('❌ SOL transfer also failed:', transferError.message);
            throw new Error(`Failed to fund createKey ${this.createKeypair!.publicKey.toString()}. Airdrop failed: ${transferError.message}. Please manually fund this address with at least 0.01 SOL.`);
          }
        }
      } else {
        console.log('✅ CreateKey has sufficient SOL');
      }

      // Final balance check before proceeding with retries
      console.log('📊 Performing final balance check...');
      let finalMember1Balance = await this.connection.getBalance(member1Keypair.publicKey);
      let finalMember2Balance = await this.connection.getBalance(member2Keypair.publicKey);
      let finalMember3Balance = member3Keypair ? await this.connection.getBalance(member3Keypair.publicKey) : 0;
      let finalCreateKeyBalance = await this.connection.getBalance(this.createKeypair!.publicKey);
      
      // If balances are still low, wait and retry a few times
      let balanceRetries = 0;
      const maxBalanceRetries = 5;
      
      const hasLowBalance = finalMember1Balance < 0.01 * LAMPORTS_PER_SOL || 
                           finalMember2Balance < 0.01 * LAMPORTS_PER_SOL || 
                           (member3Keypair && finalMember3Balance < 0.01 * LAMPORTS_PER_SOL) ||
                           finalCreateKeyBalance < 0.01 * LAMPORTS_PER_SOL;
      
      while (hasLowBalance && balanceRetries < maxBalanceRetries) {
        console.log(`⚠️ Low balances detected (retry ${balanceRetries + 1}/${maxBalanceRetries}):`);
        console.log(`   Member 1: ${finalMember1Balance / LAMPORTS_PER_SOL} SOL`);
        console.log(`   Member 2: ${finalMember2Balance / LAMPORTS_PER_SOL} SOL`);
        if (member3Keypair) {
          console.log(`   Member 3: ${finalMember3Balance / LAMPORTS_PER_SOL} SOL`);
        }
        console.log(`   CreateKey: ${finalCreateKeyBalance / LAMPORTS_PER_SOL} SOL`);
        
        console.log('⏳ Waiting for balance updates...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        finalMember1Balance = await this.connection.getBalance(member1Keypair.publicKey);
        finalMember2Balance = await this.connection.getBalance(member2Keypair.publicKey);
        if (member3Keypair) {
          finalMember3Balance = await this.connection.getBalance(member3Keypair.publicKey);
        }
        finalCreateKeyBalance = await this.connection.getBalance(this.createKeypair!.publicKey);
        balanceRetries++;
      }
      
      console.log('📊 Final balances before multisig creation:');
      console.log(`   Member 1: ${finalMember1Balance / LAMPORTS_PER_SOL} SOL (${finalMember1Balance} lamports)`);
      console.log(`   Member 2: ${finalMember2Balance / LAMPORTS_PER_SOL} SOL (${finalMember2Balance} lamports)`);
      if (member3Keypair) {
        console.log(`   Member 3: ${finalMember3Balance / LAMPORTS_PER_SOL} SOL (${finalMember3Balance} lamports)`);
      }
      console.log(`   CreateKey: ${finalCreateKeyBalance / LAMPORTS_PER_SOL} SOL (${finalCreateKeyBalance} lamports)`);
      
      if (finalMember1Balance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(`Member 1 ${member1Keypair.publicKey.toString()} has insufficient SOL: ${finalMember1Balance / LAMPORTS_PER_SOL} SOL. Please check Solana Explorer: https://explorer.solana.com/address/${member1Keypair.publicKey.toString()}`);
      }
      
      if (finalMember2Balance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(`Member 2 ${member2Keypair.publicKey.toString()} has insufficient SOL: ${finalMember2Balance / LAMPORTS_PER_SOL} SOL. Please check Solana Explorer: https://explorer.solana.com/address/${member2Keypair.publicKey.toString()}`);
      }
      
      if (member3Keypair && finalMember3Balance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(`Member 3 ${member3Keypair.publicKey.toString()} has insufficient SOL: ${finalMember3Balance / LAMPORTS_PER_SOL} SOL. Please check Solana Explorer: https://explorer.solana.com/address/${member3Keypair.publicKey.toString()}`);
      }
      
      if (finalCreateKeyBalance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(`CreateKey ${this.createKeypair!.publicKey.toString()} has insufficient SOL: ${finalCreateKeyBalance / LAMPORTS_PER_SOL} SOL. Please check Solana Explorer: https://explorer.solana.com/address/${this.createKeypair!.publicKey.toString()}`);
      }

      // The multisigCreateV2 instruction requires both the creator and the createKey to sign
      const allSigners = [member1Keypair, this.createKeypair!];
      console.log(`🔐 Signing transaction with ${allSigners.length} signers (creator + createKey)`);
      console.log('📝 Note: Both creator and createKey must sign the multisig creation transaction');
      
      // Use sendAndConfirmTransaction with creator and createKey
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
          const member1Balance = await this.connection.getBalance(member1Keypair.publicKey);
          const member2Balance = await this.connection.getBalance(member2Keypair.publicKey);
          console.error('💰 Current balances:');
          console.error(`   Member 1: ${member1Balance / LAMPORTS_PER_SOL} SOL`);
          console.error(`   Member 2: ${member2Balance / LAMPORTS_PER_SOL} SOL`);
        }
        
        throw error;
      }

      console.log(`✅ Multisig created successfully! Signature: ${signature}`);
      
      // Track activity for all members involved in multisig creation
      try {
        await adminInactivityService.updateAdminActivity(member1Keypair.publicKey.toString());
        await adminInactivityService.updateAdminActivity(member2Keypair.publicKey.toString());
        if (member3Keypair) {
          await adminInactivityService.updateAdminActivity(member3Keypair.publicKey.toString());
        }
        console.log('📊 Updated activity for all multisig members');
      } catch (activityError) {
        console.warn('⚠️ Failed to update member activity:', activityError);
        // Don't fail the multisig creation if activity tracking fails
      }
      
      return {
        multisigPda: multisigPda.toString(),
        createKey: this.createKey.toString(),
        transactionSignature: signature,
        memberPublicKeys: [
          member1Keypair.publicKey.toString(),
          member2Keypair.publicKey.toString()
        ], // Member 1 + Member 2 from provided private keys
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

    // Derive vault PDAs
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
    currency: string = "USDC",
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
   * Get the main multisig PDA from database
   */
  static async getMainMultisigPda(): Promise<string | null> {
    try {
      const mainMultisig = await prisma.multisig.findFirst({
        where: { 
          isActive: true,
          name: "Main Multisig"
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return mainMultisig?.multisigPda || null;
    } catch (error) {
      console.error('Error getting main multisig PDA:', error);
      return null;
    }
  }

  /**
   * Get multisig PDA address as string
   */
  getMultisigPdaAddress(): string | null {
    return this.multisigPda?.toString() || null;
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
    // Load configuration from environment variables
    const multisigConfig = getMultisigConfig();
    
    const config: MultisigConfig = {
      rpcUrl: multisigConfig.rpcUrl,
      // Default values for multisig creation (not used for specific user operations)
      threshold: multisigConfig.defaultThreshold,
      members: []
    };
    
    console.log(`🔗 Using Solana RPC: ${config.rpcUrl}`);
    console.log(`⚙️ Using environment configuration for multisig defaults`);
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

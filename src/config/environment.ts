/**
 * Environment Configuration
 * 
 * This file handles environment variable loading and validation
 * for the multisig system.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface MultisigConfig {
  member1PrivateKey: string;
  member2PrivateKey: string;
  member3PrivateKey?: string; // Optional third member
  defaultThreshold: number;
  defaultTimeLock: number;
  rpcUrl: string;
  solanaNetwork: string;
  minMembers: number;
  maxMembers: number;
}

/**
 * Validates and loads multisig configuration from environment variables
 */
export function loadMultisigConfig(): MultisigConfig {
  const member1PrivateKey = process.env.MULTISIG_MEMBER_1_PRIVATE_KEY;
  const member2PrivateKey = process.env.MULTISIG_MEMBER_2_PRIVATE_KEY;
  const member3PrivateKey = process.env.MULTISIG_MEMBER_3_PRIVATE_KEY; // Optional third member
  const defaultThreshold = parseInt(process.env.MULTISIG_DEFAULT_THRESHOLD || '0'); // 0 means use member count
  const defaultTimeLock = parseInt(process.env.MULTISIG_DEFAULT_TIME_LOCK || '0');
  const rpcUrl = process.env.RPC_URL || process.env.RPC || 'https://api.devnet.solana.com';
  const solanaNetwork = process.env.SOLANA_NETWORK || 'devnet';
  const minMembers = parseInt(process.env.MULTISIG_MIN_MEMBERS || '2');
  const maxMembers = parseInt(process.env.MULTISIG_MAX_MEMBERS || '3');

  // Validate required environment variables
  if (!member1PrivateKey) {
    throw new Error('MULTISIG_MEMBER_1_PRIVATE_KEY environment variable is required');
  }

  if (!member2PrivateKey) {
    throw new Error('MULTISIG_MEMBER_2_PRIVATE_KEY environment variable is required');
  }

  // Validate private key format (basic check for base58)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(member1PrivateKey)) {
    throw new Error('MULTISIG_MEMBER_1_PRIVATE_KEY must be a valid base58 encoded private key');
  }

  if (!base58Regex.test(member2PrivateKey)) {
    throw new Error('MULTISIG_MEMBER_2_PRIVATE_KEY must be a valid base58 encoded private key');
  }

  // Validate third member if provided
  if (member3PrivateKey && !base58Regex.test(member3PrivateKey)) {
    throw new Error('MULTISIG_MEMBER_3_PRIVATE_KEY must be a valid base58 encoded private key');
  }

  // Validate numeric values
  if (isNaN(defaultThreshold) || defaultThreshold < 0) {
    throw new Error('MULTISIG_DEFAULT_THRESHOLD must be a non-negative integer (0 = use member count)');
  }

  if (isNaN(defaultTimeLock) || defaultTimeLock < 0) {
    throw new Error('MULTISIG_DEFAULT_TIME_LOCK must be a non-negative integer');
  }

  if (isNaN(minMembers) || minMembers < 2 || minMembers > 3) {
    throw new Error('MULTISIG_MIN_MEMBERS must be between 2 and 3');
  }

  if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 3) {
    throw new Error('MULTISIG_MAX_MEMBERS must be between 2 and 3');
  }

  if (minMembers > maxMembers) {
    throw new Error('MULTISIG_MIN_MEMBERS cannot be greater than MULTISIG_MAX_MEMBERS');
  }

  // Validate that we have enough members for the minimum requirement
  const memberCount = 2 + (member3PrivateKey ? 1 : 0);
  if (memberCount < minMembers) {
    throw new Error(`Not enough members provided. Required: ${minMembers}, Provided: ${memberCount}`);
  }

  // Validate threshold if it's not 0 (use member count)
  if (defaultThreshold > 0 && defaultThreshold > memberCount) {
    throw new Error(`MULTISIG_DEFAULT_THRESHOLD (${defaultThreshold}) cannot exceed member count (${memberCount})`);
  }

  return {
    member1PrivateKey,
    member2PrivateKey,
    member3PrivateKey,
    defaultThreshold,
    defaultTimeLock,
    rpcUrl,
    solanaNetwork,
    minMembers,
    maxMembers
  };
}

/**
 * Gets the multisig configuration with fallback to default values
 */
export function getMultisigConfig(): MultisigConfig {
  try {
    return loadMultisigConfig();
  } catch (error) {
    console.warn('⚠️ Failed to load multisig config from environment:', error.message);
    console.warn('🔄 Using default configuration...');
    
    // Fallback to hardcoded values if environment variables are not set
    return {
      member1PrivateKey: "5zJzZD9pkyyCX4u4SGeMhz4Ji6rakKWisNhzjRaNS1owM1cJZLhtZuHKE8PHnsnWQQGUZWjtvTeNwAwxkkY6UrEn",
      member2PrivateKey: "42bg24YDM4qCP9Q9Kwzs91tPfAxT5U4nbtdGpe5GAYdZRTFV5vYsmZ9o2DRFdBgdLk5Q1piWtt9CoqGJaRgYk2Qj",
      member3PrivateKey: undefined, // No third member by default
      defaultThreshold: 0, // 0 means use member count (all must approve)
      defaultTimeLock: 0,
      rpcUrl: 'https://api.devnet.solana.com',
      solanaNetwork: 'devnet',
      minMembers: 2,
      maxMembers: 3
    };
  }
}

/**
 * Validates that the private keys can be converted to valid keypairs
 */
export function validatePrivateKeys(config: MultisigConfig): boolean {
  try {
    const { Keypair } = require('@solana/web3.js');
    const bs58 = require('bs58');
    
    // Try to create keypairs from the private keys
    const member1Keypair = Keypair.fromSecretKey(bs58.decode(config.member1PrivateKey));
    const member2Keypair = Keypair.fromSecretKey(bs58.decode(config.member2PrivateKey));
    
    console.log('✅ Multisig member keys validated:');
    console.log(`   Member 1: ${member1Keypair.publicKey.toString()}`);
    console.log(`   Member 2: ${member2Keypair.publicKey.toString()}`);
    
    // Validate third member if provided
    if (config.member3PrivateKey) {
      const member3Keypair = Keypair.fromSecretKey(bs58.decode(config.member3PrivateKey));
      console.log(`   Member 3: ${member3Keypair.publicKey.toString()}`);
    }
    
    console.log(`   Total members: ${2 + (config.member3PrivateKey ? 1 : 0)}`);
    console.log(`   Min/Max members: ${config.minMembers}/${config.maxMembers}`);
    
    return true;
  } catch (error) {
    console.error('❌ Invalid private keys in configuration:', error.message);
    return false;
  }
}

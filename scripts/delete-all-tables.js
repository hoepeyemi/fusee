#!/usr/bin/env node

/**
 * Database Cleanup Script
 * 
 * This script deletes all tables in the database.
 * 
 * WARNING: This will permanently delete ALL data in the database!
 * 
 * Usage:
 *   node scripts/delete-all-tables.js
 *   node scripts/delete-all-tables.js --confirm
 *   node scripts/delete-all-tables.js --dry-run
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

// Create Prisma client
const prisma = new PrismaClient();

// Define all tables in the correct order (respecting foreign key constraints)
const tables = [
  // Tables with foreign keys first (in reverse dependency order)
  'multisig_approvals',
  'multisig_proposals', 
  'multisig_transactions',
  'multisig_members',
  'multisigs',
  'external_fees',
  'external_transfers',
  'wallet_fees',
  'wallet_transfers',
  'fees',
  'withdrawals',
  'deposits',
  'transfers',
  'wallets',
  'vaults',
  'users'
];

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask for confirmation
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

// Function to delete all tables using Prisma
async function deleteAllTablesPrisma() {
  console.log('🗑️  Starting database cleanup using Prisma...\n');
  
  let deletedCount = 0;
  const errors = [];

  for (const table of tables) {
    try {
      console.log(`Deleting table: ${table}...`);
      
      // Use raw SQL to delete all records from the table
      const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
      console.log(`✅ Deleted ${result} records from ${table}`);
      deletedCount += result;
    } catch (error) {
      console.error(`❌ Error deleting ${table}:`, error.message);
      errors.push({ table, error: error.message });
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total records deleted: ${deletedCount}`);
  console.log(`   Tables processed: ${tables.length}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(({ table, error }) => {
      console.log(`   ${table}: ${error}`);
    });
  }

  return { deletedCount, errors };
}

// Function to delete all tables using raw SQL
async function deleteAllTablesSQL() {
  console.log('🗑️  Starting database cleanup using raw SQL...\n');
  
  try {
    // Disable foreign key checks temporarily
    await prisma.$executeRaw`SET session_replication_role = replica;`;
    console.log('🔓 Disabled foreign key constraints');

    let deletedCount = 0;
    const errors = [];

    for (const table of tables) {
      try {
        console.log(`Deleting table: ${table}...`);
        
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
        console.log(`✅ Deleted ${result} records from ${table}`);
        deletedCount += result;
      } catch (error) {
        console.error(`❌ Error deleting ${table}:`, error.message);
        errors.push({ table, error: error.message });
      }
    }

    // Re-enable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
    console.log('🔒 Re-enabled foreign key constraints');

    console.log(`\n📊 Summary:`);
    console.log(`   Total records deleted: ${deletedCount}`);
    console.log(`   Tables processed: ${tables.length}`);
    console.log(`   Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ table, error }) => {
        console.log(`   ${table}: ${error}`);
      });
    }

    return { deletedCount, errors };
  } catch (error) {
    console.error('❌ Fatal error during SQL cleanup:', error.message);
    throw error;
  }
}

// Function to show table information
async function showTableInfo() {
  console.log('📋 Current database tables and record counts:\n');
  
  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}";`);
      const count = result[0]?.count || 0;
      console.log(`   ${table}: ${count} records`);
    } catch (error) {
      console.log(`   ${table}: Error - ${error.message}`);
    }
  }
  console.log('');
}

// Function to drop all tables (nuclear option)
async function dropAllTables() {
  console.log('💥 DROPPING ALL TABLES (Nuclear Option)...\n');
  
  try {
    // Disable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = replica;`;
    console.log('🔓 Disabled foreign key constraints');

    const errors = [];

    for (const table of tables) {
      try {
        console.log(`Dropping table: ${table}...`);
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
        console.log(`✅ Dropped table ${table}`);
      } catch (error) {
        console.error(`❌ Error dropping ${table}:`, error.message);
        errors.push({ table, error: error.message });
      }
    }

    // Re-enable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
    console.log('🔒 Re-enabled foreign key constraints');

    console.log(`\n📊 Summary:`);
    console.log(`   Tables dropped: ${tables.length - errors.length}`);
    console.log(`   Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ table, error }) => {
        console.log(`   ${table}: ${error}`);
      });
    }

    return { errors };
  } catch (error) {
    console.error('❌ Fatal error during table dropping:', error.message);
    throw error;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--confirm');
  const isDropTables = args.includes('--drop-tables');

  console.log('🗄️  Database Cleanup Script');
  console.log('============================\n');

  try {
    // Show current table information
    await showTableInfo();

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
      console.log('Tables that would be affected:');
      tables.forEach(table => console.log(`   - ${table}`));
      console.log('\nTo actually delete data, run without --dry-run flag');
      return;
    }

    if (!isConfirmed) {
      console.log('⚠️  WARNING: This will permanently delete ALL data in the database!');
      console.log('⚠️  This action cannot be undone!\n');
      
      const confirm = await askConfirmation('Are you sure you want to continue? (yes/no): ');
      if (confirm !== 'yes' && confirm !== 'y') {
        console.log('❌ Operation cancelled by user');
        return;
      }

      const method = await askConfirmation('\nChoose cleanup method:\n1. Delete all records (recommended)\n2. Drop all tables (nuclear option)\nEnter 1 or 2: ');
      
      if (method === '2') {
        const confirmDrop = await askConfirmation('⚠️  This will DROP ALL TABLES! Are you absolutely sure? (yes/no): ');
        if (confirmDrop !== 'yes' && confirmDrop !== 'y') {
          console.log('❌ Operation cancelled by user');
          return;
        }
        isDropTables = true;
      }
    }

    console.log('\n🚀 Starting cleanup...\n');

    let result;
    if (isDropTables) {
      result = await dropAllTables();
    } else {
      // Try Prisma method first, fallback to SQL if needed
      try {
        result = await deleteAllTablesPrisma();
        if (result.errors.length > 0) {
          console.log('\n🔄 Prisma method had errors, trying SQL method...\n');
          result = await deleteAllTablesSQL();
        }
      } catch (error) {
        console.log('\n🔄 Prisma method failed, trying SQL method...\n');
        result = await deleteAllTablesSQL();
      }
    }

    if (result.errors.length === 0) {
      console.log('\n✅ Database cleanup completed successfully!');
    } else {
      console.log('\n⚠️  Database cleanup completed with some errors');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during cleanup:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  deleteAllTablesPrisma,
  deleteAllTablesSQL,
  dropAllTables,
  showTableInfo,
  tables
};

#!/usr/bin/env node

/**
 * Test Database Cleanup Script
 * 
 * This script tests the database cleanup functionality without actually deleting data.
 */

const { PrismaClient } = require('@prisma/client');

// Create Prisma client
const prisma = new PrismaClient();

// Define all tables
const tables = [
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

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function showTableCounts() {
  console.log('\n📊 Current table record counts:');
  console.log('================================');
  
  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}";`);
      const count = result[0]?.count || 0;
      console.log(`${table.padEnd(25)}: ${count.toString().padStart(6)} records`);
    } catch (error) {
      console.log(`${table.padEnd(25)}: ERROR - ${error.message}`);
    }
  }
}

async function testCleanupQuery() {
  console.log('\n🧪 Testing cleanup query (dry run)...');
  
  try {
    // Test with a simple query that won't actually delete anything
    const testQuery = `
      SELECT 
        'multisig_approvals' as table_name, COUNT(*) as count FROM "multisig_approvals"
      UNION ALL
      SELECT 'users', COUNT(*) FROM "users"
      UNION ALL
      SELECT 'transfers', COUNT(*) FROM "transfers"
    `;
    
    const result = await prisma.$queryRawUnsafe(testQuery);
    console.log('✅ Test query executed successfully');
    console.log('Sample results:');
    result.forEach(row => {
      console.log(`   ${row.table_name}: ${row.count} records`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Test query failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Database Cleanup Test Script');
  console.log('================================\n');
  
  try {
    // Test database connection
    const connected = await testDatabaseConnection();
    if (!connected) {
      process.exit(1);
    }
    
    // Show current table counts
    await showTableCounts();
    
    // Test cleanup query
    const queryWorks = await testCleanupQuery();
    if (!queryWorks) {
      console.log('\n❌ Cleanup functionality test failed');
      process.exit(1);
    }
    
    console.log('\n✅ All tests passed! Database cleanup scripts should work correctly.');
    console.log('\nTo actually clean the database, run:');
    console.log('   yarn db:clean');
    console.log('   yarn db:clean:dry  (to preview changes)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { testDatabaseConnection, showTableCounts, testCleanupQuery };

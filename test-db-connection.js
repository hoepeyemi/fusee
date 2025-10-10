const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check if multisig_members table exists
    try {
      const result = await prisma.multisigMember.findMany();
      console.log('✅ multisig_members table exists, found', result.length, 'records');
    } catch (error) {
      console.log('❌ multisig_members table does not exist:', error.message);
      
      // Try to create the table by running a simple query
      try {
        console.log('🔄 Attempting to create table...');
        await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS multisig_members (
          id SERIAL PRIMARY KEY,
          "multisigId" INTEGER,
          "userId" INTEGER,
          "publicKey" TEXT UNIQUE NOT NULL,
          permissions TEXT NOT NULL,
          "isActive" BOOLEAN DEFAULT true,
          "lastActivityAt" TIMESTAMP DEFAULT NOW(),
          "isInactive" BOOLEAN DEFAULT false,
          "inactiveSince" TIMESTAMP,
          "removalEligibleAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )`;
        console.log('✅ Table created successfully');
      } catch (createError) {
        console.log('❌ Failed to create table:', createError.message);
      }
    }
    
    // List all tables
    try {
      const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
      console.log('📋 Available tables:', tables.map(t => t.table_name));
    } catch (error) {
      console.log('❌ Could not list tables:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();



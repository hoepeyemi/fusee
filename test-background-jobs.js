const { BackgroundJobs } = require('./dist/services/backgroundJobs');

// Test background jobs functionality
async function testBackgroundJobs() {
  console.log('🧪 Testing Background Jobs...\n');

  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    await BackgroundJobs.checkDatabaseConnection();
    console.log('✅ Database connection successful\n');

    // Test manual check
    console.log('🔍 Running manual inactive member check...');
    await BackgroundJobs.runManualCheck();
    console.log('✅ Manual check completed\n');

    console.log('🎉 All background job tests passed!');

  } catch (error) {
    console.error('❌ Background job test failed:', error.message);
    
    if (error.message.includes('Database connection failed')) {
      console.log('\n💡 This is expected if the database is not available locally.');
      console.log('   The background jobs will handle this gracefully in production.');
    }
  }
}

// Run the test
testBackgroundJobs();

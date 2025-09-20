const https = require('https');
const http = require('http');

// Test CORS configuration
async function testCORSFix() {
  console.log('🌐 Testing CORS Configuration Fix...\n');

  // Test different origins
  const testOrigins = [
    'https://fusee.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  for (const origin of testOrigins) {
    console.log(`Testing origin: ${origin}`);
    
    try {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/csrf-token',
        method: 'GET',
        headers: {
          'Origin': origin,
          'Accept': 'application/json'
        }
      };

      const response = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data ? JSON.parse(data) : null
            });
          });
        });
        
        req.on('error', reject);
        req.end();
      });

      console.log(`✅ Status: ${response.statusCode}`);
      console.log(`✅ CORS Headers: ${response.headers['access-control-allow-origin'] || 'None'}`);
      console.log(`✅ Response: ${response.data ? 'Success' : 'No data'}\n`);

    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('🎉 CORS test completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Deploy the updated code to Render.com');
  console.log('2. Test the Swagger UI at https://fusee.onrender.com/api-docs');
  console.log('3. Try the multisig create endpoint again');
}

// Run the test if server is running
testCORSFix().catch(console.error);

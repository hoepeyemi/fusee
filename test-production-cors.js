const https = require('https');

// Test production CORS with the exact scenario from the error
async function testProductionCORS() {
  console.log('🌐 Testing Production CORS Configuration...\n');

  const productionUrl = 'https://fusee.onrender.com';
  
  try {
    console.log('📍 Testing production server CORS...');
    console.log('   URL:', productionUrl);
    console.log('   Origin: https://fusee.onrender.com (same-origin request)');
    
    // Test with the exact origin that was blocked
    const response = await makeHttpsRequest('GET', `${productionUrl}/api/csrf-token`, {
      'Origin': 'https://fusee.onrender.com',
      'User-Agent': 'Mozilla/5.0 (compatible; CORS-Test/1.0)'
    });
    
    console.log('\n📊 Response Details:');
    console.log('   Status:', response.status);
    console.log('   CORS Headers:');
    console.log('     Access-Control-Allow-Origin:', response.headers['access-control-allow-origin'] || 'Not set');
    console.log('     Access-Control-Allow-Credentials:', response.headers['access-control-allow-credentials'] || 'Not set');
    console.log('     Access-Control-Allow-Methods:', response.headers['access-control-allow-methods'] || 'Not set');
    console.log('     Access-Control-Allow-Headers:', response.headers['access-control-allow-headers'] || 'Not set');
    
    if (response.status === 200) {
      console.log('\n✅ CORS Test PASSED - Server is accessible');
      console.log('   Response data:', response.data);
    } else {
      console.log('\n❌ CORS Test FAILED - Server returned error');
      console.log('   Error details:', response.data);
    }
    
  } catch (error) {
    console.log('\n❌ CORS Test FAILED - Request error');
    console.log('   Error:', error.message);
    
    if (error.message.includes('CORS')) {
      console.log('\n💡 CORS Issue Detected:');
      console.log('   - The server is blocking requests from https://fusee.onrender.com');
      console.log('   - This suggests the CORS configuration needs to be updated');
      console.log('   - Check that the production environment is using the correct CORS settings');
    }
  }
}

// Helper function to make HTTPS requests
function makeHttpsRequest(method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ 
            status: res.statusCode, 
            data: jsonBody, 
            headers: res.headers,
            rawBody: body
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: body, 
            headers: res.headers,
            rawBody: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Run the test
testProductionCORS();

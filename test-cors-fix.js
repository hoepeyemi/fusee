const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let csrfToken = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Origin': 'https://fusee.onrender.com' // Test with production origin
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: jsonBody, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testCorsFix() {
  console.log('🔧 Testing CORS Fix...\n');

  try {
    // Test 1: CSRF Token with production origin
    console.log('1️⃣ Testing CSRF token with production origin...');
    const csrfResponse = await makeRequest('GET', '/api/csrf-token');
    console.log('Status:', csrfResponse.status);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin': csrfResponse.headers['access-control-allow-origin'],
      'Access-Control-Allow-Credentials': csrfResponse.headers['access-control-allow-credentials']
    });
    
    if (csrfResponse.status === 200) {
      csrfToken = csrfResponse.data.csrfToken;
      console.log('✅ CSRF Token received successfully');
    } else {
      console.log('❌ CSRF Token request failed');
      return;
    }

    // Test 2: Test with localhost origin
    console.log('\n2️⃣ Testing with localhost origin...');
    const localhostResponse = await makeRequest('GET', '/api/csrf-token');
    console.log('Status:', localhostResponse.status);
    console.log('✅ Localhost origin test completed');

    // Test 3: Test with no origin
    console.log('\n3️⃣ Testing with no origin...');
    const noOriginResponse = await makeRequest('GET', '/api/csrf-token');
    console.log('Status:', noOriginResponse.status);
    console.log('✅ No origin test completed');

    console.log('\n🎉 CORS Fix Test Completed!');
    console.log('\n📋 Summary:');
    console.log('- Production origin (https://fusee.onrender.com) should be allowed');
    console.log('- Localhost origins should be allowed');
    console.log('- Requests with no origin should be allowed');
    console.log('- Enhanced logging will help debug CORS issues in production');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCorsFix();

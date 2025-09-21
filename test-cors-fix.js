const https = require('https');
const http = require('http');

// Test CORS configuration
async function testCORS() {
  console.log('🧪 Testing CORS Configuration...\n');

  const testUrls = [
    'http://localhost:3000',
    'https://fusee.onrender.com'
  ];

  for (const baseUrl of testUrls) {
    console.log(`\n📍 Testing ${baseUrl}:`);
    
    try {
      // Test CSRF token endpoint
      const response = await makeRequest('GET', `${baseUrl}/api/csrf-token`);
      
      if (response.status === 200) {
        console.log('✅ CSRF Token endpoint working');
        console.log('   Response:', response.data);
      } else {
        console.log('❌ CSRF Token endpoint failed:', response.status);
      }
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
  }
}

// Helper function to make HTTP requests
function makeRequest(method, url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://fusee.onrender.com' // Test with the problematic origin
      }
    };

    const req = client.request(url, options, (res) => {
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
    req.end();
  });
}

// Run the test
testCORS();

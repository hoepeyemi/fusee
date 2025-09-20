const https = require('https');

// Test multisig creation with proper CSRF token handling
async function testMultisigWithCSRF() {
  console.log('🔐 Testing Multisig Creation with CSRF Token...\n');

  try {
    // Step 1: Get CSRF token
    console.log('📝 Step 1: Getting CSRF token...');
    const csrfToken = await getCSRFToken();
    console.log(`✅ CSRF Token: ${csrfToken}\n`);

    // Step 2: Create multisig with CSRF token
    console.log('🔐 Step 2: Creating multisig with CSRF token...');
    const result = await createMultisig(csrfToken);
    console.log('✅ Multisig creation result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Get CSRF token
function getCSRFToken() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'fusee.onrender.com',
      port: 443,
      path: '/api/csrf-token',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.csrfToken) {
            resolve(response.csrfToken);
          } else {
            reject(new Error('No CSRF token in response'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse CSRF response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`CSRF request failed: ${error.message}`));
    });

    req.end();
  });
}

// Create multisig with CSRF token
function createMultisig(csrfToken) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      name: "Test Multisig",
      threshold: 1,
      timeLock: 0,
      members: [
        {
          publicKey: "Hru8CjwVTfKWtQtZe7Aa7rVaWp9k3ku5ca6zN8LshY87",
          permissions: ["propose", "vote", "execute"]
        }
      ]
    });

    const options = {
      hostname: 'fusee.onrender.com',
      port: 443,
      path: '/api/multisig/create',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`Multisig creation failed: ${res.statusCode} - ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse multisig response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Multisig request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
testMultisigWithCSRF();

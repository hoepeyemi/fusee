const https = require('https');

// Test multisig creation with unique constraint handling
async function testMultisigUniqueConstraint() {
  console.log('🔐 Testing Multisig Unique Constraint Handling...\n');

  try {
    // Step 1: Get CSRF token
    console.log('📝 Step 1: Getting CSRF token...');
    const csrfToken = await getCSRFToken();
    console.log(`✅ CSRF Token: ${csrfToken}\n`);

    // Step 2: Create first multisig
    console.log('🔐 Step 2: Creating first multisig...');
    const result1 = await createMultisig(csrfToken, "Test Multisig 1");
    console.log('✅ First multisig created:', JSON.stringify(result1, null, 2));

    // Step 3: Try to create multisig with same member (should handle gracefully)
    console.log('\n🔐 Step 3: Creating second multisig with same member...');
    const result2 = await createMultisig(csrfToken, "Test Multisig 2");
    console.log('✅ Second multisig handled:', JSON.stringify(result2, null, 2));

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
function createMultisig(csrfToken, name) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      name: name,
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
testMultisigUniqueConstraint();

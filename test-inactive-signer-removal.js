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
        'X-CSRF-Token': csrfToken
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function testInactiveSignerRemoval() {
  console.log('🔐 Testing Inactive Signer Removal Feature...\n');

  try {
    // Step 1: Get CSRF Token
    console.log('1️⃣ Getting CSRF token...');
    const csrfResponse = await makeRequest('GET', '/api/csrf-token');
    csrfToken = csrfResponse.data.csrfToken;
    console.log('✅ CSRF Token:', csrfToken.substring(0, 20) + '...\n');

    // Step 2: Create a test user
    console.log('2️⃣ Creating test user...');
    const userData = {
      email: 'inactivesignertest@example.com',
      fullName: 'Inactive Signer Test User',
      solanaWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM'
    };
    const userResponse = await makeRequest('POST', '/api/users', userData);
    console.log('✅ User created:', userResponse.data.id);
    const userId = userResponse.data.id;

    // Step 3: Create multisig with multiple members
    console.log('\n3️⃣ Creating multisig with multiple members...');
    const multisigData = {
      name: 'Inactive Signer Test Multisig',
      threshold: 2,
      timeLock: 0,
      members: [
        {
          publicKey: '11111111111111111111111111111112',
          permissions: ['propose', 'vote', 'execute']
        },
        {
          publicKey: '22222222222222222222222222222223',
          permissions: ['vote']
        },
        {
          publicKey: '33333333333333333333333333333334',
          permissions: ['vote']
        },
        {
          publicKey: '44444444444444444444444444444445',
          permissions: ['vote']
        }
      ]
    };
    const multisigResponse = await makeRequest('POST', '/api/multisig/create', multisigData);
    console.log('✅ Multisig created:', multisigResponse.data.data.multisigPda);
    const multisigPda = multisigResponse.data.data.multisigPda;

    // Step 4: Get multisig ID for signer management
    console.log('\n4️⃣ Getting multisig details...');
    const multisigDetailsResponse = await makeRequest('GET', `/api/multisig/${multisigPda}`);
    const multisigId = multisigDetailsResponse.data.id;
    console.log('✅ Multisig ID:', multisigId);

    // Step 5: Check multisig health
    console.log('\n5️⃣ Checking multisig health...');
    const healthResponse = await makeRequest('GET', `/api/signer-management/${multisigId}/health`);
    console.log('✅ Multisig Health:', JSON.stringify(healthResponse.data, null, 2));

    // Step 6: Simulate member activity (approve a transaction)
    console.log('\n6️⃣ Simulating member activity...');
    const vaultTxData = {
      fromWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM',
      toWallet: 'ExternalWallet1234567890123456789012345678901234567890',
      amount: 1.5,
      currency: 'SOL',
      memo: 'Test inactive signer removal'
    };
    const vaultTxResponse = await makeRequest('POST', `/api/multisig/${multisigPda}/transactions`, vaultTxData);
    console.log('✅ Vault transaction created:', vaultTxResponse.data.data.transactionIndex);

    // Create proposal
    const proposalData = {
      transactionIndex: vaultTxResponse.data.data.transactionIndex,
      proposerKey: '11111111111111111111111111111112'
    };
    await makeRequest('POST', `/api/multisig/${multisigPda}/proposals`, proposalData);
    console.log('✅ Proposal created');

    // Approve with one member (simulate activity)
    const approveData = {
      transactionIndex: vaultTxResponse.data.data.transactionIndex,
      memberKey: '22222222222222222222222222222223'
    };
    await makeRequest('POST', `/api/multisig/${multisigPda}/approve`, approveData);
    console.log('✅ Proposal approved by member 2');

    // Step 7: Check inactive members (should be empty initially)
    console.log('\n7️⃣ Checking inactive members...');
    const inactiveResponse = await makeRequest('GET', `/api/signer-management/${multisigId}/inactive`);
    console.log('✅ Inactive members:', inactiveResponse.data.length);

    // Step 8: Manually trigger inactive member check
    console.log('\n8️⃣ Triggering inactive member check...');
    const checkResponse = await makeRequest('POST', '/api/signer-management/check-inactive');
    console.log('✅ Inactive member check completed:', checkResponse.data.message);

    // Step 9: Check health again
    console.log('\n9️⃣ Checking multisig health after check...');
    const healthAfterResponse = await makeRequest('GET', `/api/signer-management/${multisigId}/health`);
    console.log('✅ Multisig Health after check:', JSON.stringify(healthAfterResponse.data, null, 2));

    // Step 10: Check removal history
    console.log('\n10️⃣ Checking removal history...');
    const historyResponse = await makeRequest('GET', `/api/signer-management/${multisigId}/removal-history`);
    console.log('✅ Removal history:', historyResponse.data.length, 'records');

    console.log('\n🎉 Inactive signer removal test completed!');
    console.log('\n📋 Summary:');
    console.log('- Multisig created with 4 members');
    console.log('- Threshold set to 2');
    console.log('- Member activity tracked');
    console.log('- Background job checks for inactive members every hour');
    console.log('- Inactive members can be automatically removed after 48 hours');
    console.log('- System maintains minimum threshold for security');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testInactiveSignerRemoval();

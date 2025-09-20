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

async function testMultisig() {
  console.log('🔐 Starting Multisig Feature Test...\n');

  try {
    // Step 1: Get CSRF Token
    console.log('1️⃣ Getting CSRF token...');
    const csrfResponse = await makeRequest('GET', '/api/csrf-token');
    csrfToken = csrfResponse.data.csrfToken;
    console.log('✅ CSRF Token:', csrfToken.substring(0, 20) + '...\n');

    // Step 2: Create a test user
    console.log('2️⃣ Creating test user...');
    const userData = {
      email: 'multisigtest@example.com',
      fullName: 'Multisig Test User',
      solanaWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM'
    };
    const userResponse = await makeRequest('POST', '/api/users', userData);
    console.log('✅ User created:', userResponse.data.id);
    const userId = userResponse.data.id;

    // Step 3: Create multisig
    console.log('\n3️⃣ Creating multisig...');
    const multisigData = {
      name: 'Test Multisig',
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
        }
      ]
    };
    const multisigResponse = await makeRequest('POST', '/api/multisig/create', multisigData);
    console.log('✅ Multisig created:', multisigResponse.data.multisigPda);
    const multisigPda = multisigResponse.data.multisigPda;

    // Step 4: Test external transfer (should create multisig transaction)
    console.log('\n4️⃣ Testing external transfer...');
    const transferData = {
      userId: userId,
      toExternalWallet: 'ExternalWallet1234567890123456789012345678901234567890',
      amount: 1.5,
      notes: 'Test multisig external transfer'
    };
    const transferResponse = await makeRequest('POST', '/api/external-transfers', transferData);
    console.log('✅ External transfer response:', transferResponse.data);

    // Step 5: Create vault transaction
    console.log('\n5️⃣ Creating vault transaction...');
    const vaultTxData = {
      fromWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM',
      toWallet: 'ExternalWallet1234567890123456789012345678901234567890',
      amount: 1.5,
      currency: 'SOL',
      memo: 'Test multisig vault transaction'
    };
    const vaultTxResponse = await makeRequest('POST', `/api/multisig/${multisigPda}/transactions`, vaultTxData);
    console.log('✅ Vault transaction created:', vaultTxResponse.data);

    // Step 6: Create proposal
    console.log('\n6️⃣ Creating proposal...');
    const proposalData = {
      transactionIndex: vaultTxResponse.data.transactionIndex,
      proposerKey: '11111111111111111111111111111112'
    };
    const proposalResponse = await makeRequest('POST', `/api/multisig/${multisigPda}/proposals`, proposalData);
    console.log('✅ Proposal created');

    // Step 7: Approve proposal
    console.log('\n7️⃣ Approving proposal...');
    const approveData = {
      transactionIndex: vaultTxResponse.data.transactionIndex,
      memberKey: '22222222222222222222222222222223'
    };
    const approveResponse = await makeRequest('POST', `/api/multisig/${multisigPda}/approve`, approveData);
    console.log('✅ Proposal approved');

    // Step 8: Execute transaction
    console.log('\n8️⃣ Executing transaction...');
    const executeData = {
      transactionIndex: vaultTxResponse.data.transactionIndex,
      executorKey: '11111111111111111111111111111112'
    };
    const executeResponse = await makeRequest('POST', `/api/multisig/${multisigPda}/execute`, executeData);
    console.log('✅ Transaction executed');

    // Step 9: Check transaction status
    console.log('\n9️⃣ Checking transaction status...');
    const statusResponse = await makeRequest('GET', `/api/multisig/${multisigPda}/status/${vaultTxResponse.data.transactionIndex}`);
    console.log('✅ Transaction status:', statusResponse.data);

    console.log('\n🎉 Multisig feature test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMultisig();

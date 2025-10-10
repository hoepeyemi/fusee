# Blockchain Deposit Monitoring System

## Overview

The Blockchain Deposit Monitoring System automatically tracks airdrop and external funding deposits by querying the Solana blockchain for deposits to user wallet addresses. This system provides real-time detection and processing of incoming funds without requiring manual intervention.

## Features

### 🔍 **Automatic Detection**
- Monitors all user wallets for new deposits
- Detects both SOL and USDC transfers
- Distinguishes between airdrops and external funding
- Processes deposits in real-time

### 📊 **Deposit Types Detected**
1. **Airdrops** - Small amounts from known faucet addresses or system programs
2. **External Funding** - Larger amounts from external wallets

### ⚡ **Background Processing**
- Runs every 5 minutes automatically
- Can be started/stopped via API
- Processes deposits and creates database records
- Updates vault balances automatically

## Architecture

### Core Services

#### 1. **BlockchainMonitorService**
- Queries Solana blockchain for user wallet transactions
- Analyzes transactions for deposit patterns
- Determines deposit types (airdrop vs external funding)
- Returns structured deposit data

#### 2. **BackgroundDepositMonitor**
- Manages background monitoring cycles
- Handles start/stop functionality
- Provides monitoring statistics
- Supports manual force runs

#### 3. **Integration Services**
- **TreasuryDepositService** - Processes airdrop deposits
- **ExternalDepositService** - Processes external funding deposits

## API Endpoints

### Blockchain Monitoring Control

#### Start Background Monitoring
```http
POST /api/blockchain-monitoring/start
```
Starts the background monitoring service that runs every 5 minutes.

#### Stop Background Monitoring
```http
POST /api/blockchain-monitoring/stop
```
Stops the background monitoring service.

#### Get Monitoring Status
```http
GET /api/blockchain-monitoring/status
```
Returns current monitoring status and statistics.

#### Force Run Monitoring
```http
POST /api/blockchain-monitoring/force-run
```
Manually triggers a monitoring cycle immediately.

### Wallet-Specific Operations

#### Check Specific Wallet
```http
GET /api/blockchain-monitoring/check-wallet/{walletAddress}
```
Checks a specific wallet for new deposits without processing them.

#### Process Wallet Deposits
```http
POST /api/blockchain-monitoring/process-deposits
Content-Type: application/json

{
  "walletAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
}
```
Detects and processes deposits for a specific wallet.

## Configuration

### Environment Variables

```bash
# Solana RPC URL for blockchain queries
SOLANA_RPC_URL="https://api.devnet.solana.com"

# Auto-start monitoring on server startup
AUTO_START_BLOCKCHAIN_MONITORING="false"
```

### Monitoring Settings

- **Monitoring Interval**: 5 minutes
- **Transaction Lookback**: 24 hours
- **Max Transactions per Wallet**: 100
- **Supported Currencies**: SOL, USDC

## Deposit Detection Logic

### Airdrop Detection
A deposit is classified as an airdrop if:
- Amount ≤ 2.0 SOL/USDC
- From known faucet addresses
- From system program addresses
- From wrapped SOL addresses

### External Funding Detection
A deposit is classified as external funding if:
- Amount > 2.0 SOL/USDC
- From unknown external addresses
- Not from system programs

### Known Airdrop Sources
```typescript
const airdropAddresses = [
  '11111111111111111111111111111112', // System Program
  'So11111111111111111111111111111111111111112', // Wrapped SOL
];

const faucetAddresses = [
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM', // Example faucet
  // Add more known faucet addresses
];
```

## Database Integration

### Deposit Records
All detected deposits are stored in the `deposits` table with:
- User ID (0 for system deposits)
- Vault ID
- Amount and currency
- Transaction hash
- Deposit type notes
- Timestamp

### Vault Balance Updates
- Treasury deposits update vault balances
- External deposits update user balances
- All deposits are tracked for audit trails

## Usage Examples

### Starting the System

1. **Automatic Start** (via environment variable):
```bash
AUTO_START_BLOCKCHAIN_MONITORING="true"
```

2. **Manual Start** (via API):
```bash
curl -X POST http://localhost:3000/api/blockchain-monitoring/start \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token"
```

### Checking Status
```bash
curl -X GET http://localhost:3000/api/blockchain-monitoring/status \
  -H "X-CSRF-Token: your-csrf-token"
```

### Force Run Monitoring
```bash
curl -X POST http://localhost:3000/api/blockchain-monitoring/force-run \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token"
```

### Check Specific Wallet
```bash
curl -X GET http://localhost:3000/api/blockchain-monitoring/check-wallet/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM \
  -H "X-CSRF-Token: your-csrf-token"
```

## Monitoring Output

### Console Logs
```
🔍 Starting blockchain monitoring for user wallets...
📊 Monitoring 2 user wallets
🔍 Checking wallet: 9WzDXwB... (User: John)
💰 Found 1 new deposits for John
✅ Monitoring complete: 1 new deposits found, 0 errors
💰 Processing 1 new deposits...
✅ Processed AIRDROP deposit: 1.5 SOL for John
✅ Monitoring cycle complete:
   New deposits found: 1
   Deposits processed: 1
   Errors: 0
⏱️ Monitoring cycle took 2341ms
```

### API Response Example
```json
{
  "message": "Monitoring cycle completed",
  "success": true,
  "depositsFound": 1,
  "depositsProcessed": 1,
  "errors": []
}
```

## Error Handling

### Common Errors
- **Connection Issues**: RPC endpoint unavailable
- **Invalid Wallet Addresses**: Malformed addresses
- **Transaction Parsing**: Failed to parse transaction data
- **Database Errors**: Failed to create deposit records

### Error Recovery
- Individual wallet errors don't stop monitoring
- Failed transactions are logged and skipped
- Database errors are logged with details
- Monitoring continues despite individual failures

## Security Considerations

### CSRF Protection
All API endpoints require CSRF tokens for security.

### Rate Limiting
- Respects Solana RPC rate limits
- Implements delays between requests
- Monitors for rate limit responses

### Data Validation
- Validates wallet addresses
- Checks transaction signatures
- Verifies deposit amounts
- Prevents duplicate processing

## Performance Optimization

### Efficient Queries
- Uses `getSignaturesForAddress` for transaction discovery
- Processes only recent transactions (24 hours)
- Limits transaction history to 100 per wallet

### Background Processing
- Non-blocking monitoring cycles
- Asynchronous deposit processing
- Error isolation per wallet

### Caching
- Avoids reprocessing known transactions
- Checks database for existing deposits
- Skips failed transactions

## Troubleshooting

### Common Issues

1. **No Deposits Detected**
   - Check RPC endpoint connectivity
   - Verify wallet addresses are correct
   - Ensure transactions are within 24-hour window

2. **Monitoring Not Starting**
   - Check environment variables
   - Verify Solana connection
   - Check server logs for errors

3. **Deposits Not Processing**
   - Check database connectivity
   - Verify user records exist
   - Check for transaction parsing errors

### Debug Commands
```bash
# Check monitoring status
curl -X GET http://localhost:3000/api/blockchain-monitoring/status

# Force run with detailed output
curl -X POST http://localhost:3000/api/blockchain-monitoring/force-run

# Check specific wallet
curl -X GET http://localhost:3000/api/blockchain-monitoring/check-wallet/{address}
```

## Future Enhancements

### Planned Features
- Support for additional SPL tokens
- Configurable monitoring intervals
- Webhook notifications for deposits
- Advanced filtering rules
- Historical deposit analysis
- Multi-network support

### Integration Opportunities
- Real-time notifications
- Mobile app integration
- Third-party wallet support
- Advanced analytics dashboard




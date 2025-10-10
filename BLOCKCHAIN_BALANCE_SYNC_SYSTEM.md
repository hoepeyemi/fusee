# Blockchain Balance Sync System

## Overview

The Blockchain Balance Sync System automatically fetches USDC balances from the Solana blockchain and updates the database every time a user balance is requested. This ensures that user balances are always up-to-date with the real blockchain state.

## Features

### 🔄 **Automatic Balance Sync**
- Fetches USDC balance from Solana blockchain on every user request
- Updates database with real-time blockchain data
- Caches balance for 5 minutes to avoid excessive API calls
- Handles errors gracefully without breaking user requests

### 💰 **USDC Token Detection**
- Detects USDC token accounts using the official USDC mint address
- Supports both mainnet and devnet USDC tokens
- Handles multiple token accounts per wallet
- Converts token amounts using proper decimal precision

### ⚡ **Performance Optimization**
- Smart caching to prevent excessive blockchain queries
- Timeout protection for blockchain requests
- Batch processing for multiple users
- Non-blocking middleware that doesn't fail requests

## Architecture

### Core Services

#### 1. **SolanaBalanceService**
- Fetches USDC and SOL balances from Solana blockchain
- Updates user balances in database
- Handles batch operations for multiple users
- Provides balance sync statistics

#### 2. **Balance Sync Middleware**
- Automatically syncs balance on user requests
- Configurable sync options (force, skip, timeout)
- Smart caching based on last update time
- Error handling and logging

#### 3. **API Integration**
- Middleware integrated into user endpoints
- Dedicated sync endpoints for manual operations
- Comprehensive error handling and responses

## API Endpoints

### User Endpoints with Auto-Sync

#### Get Single User (with balance sync)
```http
GET /api/users/{id}
```
Automatically syncs balance from blockchain if stale (>5 minutes old).

#### Find User by Email (with balance sync)
```http
GET /api/users/find?email={email}
```
Automatically syncs balance from blockchain if stale.

#### Get All Users (skip sync for performance)
```http
GET /api/users/all
```
Skips balance sync to avoid performance issues with large user lists.

### Manual Balance Sync Endpoints

#### Force Sync Single User Balance
```http
POST /api/users/{id}/sync-balance
```
Force syncs a specific user's balance from the blockchain.

**Response:**
```json
{
  "message": "Balance synced successfully from Solana blockchain",
  "userId": 1,
  "newBalance": 150.75,
  "lastUpdated": "2024-01-15T10:30:00Z",
  "walletAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
}
```

#### Sync All Users' Balances
```http
POST /api/users/sync-all-balances
```
Syncs balances for all users with wallet addresses.

**Response:**
```json
{
  "message": "Balance sync completed",
  "updated": 15,
  "errors": []
}
```

## Configuration

### Environment Variables

```bash
# Solana RPC URL for balance queries
SOLANA_RPC_URL="https://api.devnet.solana.com"

# USDC mint address (default: mainnet USDC)
USDC_MINT_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

### Middleware Options

#### Auto-Sync Middleware
```typescript
syncUserBalanceOnRequest // Syncs if balance is stale (>5 minutes)
```

#### Force Sync Middleware
```typescript
forceSyncUserBalance // Always syncs from blockchain
```

#### Skip Sync Middleware
```typescript
skipBalanceSync // Skips sync for performance
```

## Balance Sync Logic

### Sync Triggers
1. **Automatic**: When user balance is requested and last update > 5 minutes
2. **Manual**: Via dedicated sync endpoints
3. **Force**: Via force sync middleware

### USDC Detection Process
1. Query all SPL token accounts for the wallet
2. Find accounts with USDC mint address
3. Extract token amount and decimals
4. Convert to human-readable USDC amount
5. Update database with new balance

### Error Handling
- Blockchain connection failures don't break user requests
- Invalid wallet addresses are logged and skipped
- Timeout protection prevents hanging requests
- Fallback to cached balance on errors

## Usage Examples

### Automatic Balance Sync
```bash
# This will automatically sync balance if stale
curl -X GET http://localhost:3000/api/users/1 \
  -H "X-CSRF-Token: your-csrf-token"
```

### Manual Balance Sync
```bash
# Force sync specific user
curl -X POST http://localhost:3000/api/users/1/sync-balance \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token"
```

### Batch Balance Sync
```bash
# Sync all users
curl -X POST http://localhost:3000/api/users/sync-all-balances \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token"
```

## Technical Implementation

### USDC Token Detection
```typescript
// USDC mint address (mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Query token accounts
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  walletPublicKey,
  { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
);

// Find USDC account
for (const account of tokenAccounts.value) {
  const tokenInfo = account.account.data.parsed.info;
  if (tokenInfo.mint === USDC_MINT) {
    const balance = parseFloat(tokenInfo.amount) / Math.pow(10, tokenInfo.decimals);
    return balance;
  }
}
```

### Balance Caching Logic
```typescript
// Check if balance should be synced
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const shouldSync = user.updatedAt < fiveMinutesAgo;

if (shouldSync) {
  await SolanaBalanceService.updateUserBalanceFromBlockchain(userId);
}
```

### Error Handling
```typescript
try {
  const result = await SolanaBalanceService.updateUserBalanceFromBlockchain(userId);
  if (result.success) {
    console.log(`✅ Balance synced: ${result.newBalance} USDC`);
  } else {
    console.warn(`⚠️ Balance sync failed: ${result.error}`);
  }
} catch (error) {
  console.error(`❌ Balance sync error:`, error);
  // Don't fail the request if balance sync fails
}
```

## Performance Considerations

### Caching Strategy
- **Cache Duration**: 5 minutes
- **Cache Key**: User ID + last update timestamp
- **Cache Invalidation**: Automatic on successful sync

### Rate Limiting
- Respects Solana RPC rate limits
- Implements request timeouts (10-15 seconds)
- Batch processing for multiple users
- Smart retry logic for failed requests

### Database Optimization
- Updates only the balance field
- Uses efficient Prisma queries
- Minimal database writes
- Proper indexing on user ID and wallet address

## Monitoring and Logging

### Console Logs
```
🔄 Syncing balance for user 1 from Solana blockchain...
💰 Fetched USDC balance for 9WzDXwB...: 150.75 USDC
✅ Updated balance for John (john@example.com): 100 → 150.75 USDC
✅ Balance synced for user 1: 150.75 USDC
```

### Error Logs
```
❌ Error fetching USDC balance for 9WzDXwB...: Connection timeout
⚠️ Balance sync failed for user 1: Connection timeout
❌ Balance sync error for user 1: Error: Connection timeout
```

### Statistics
- Total users with wallets
- Last sync time
- Sync success/failure rates
- Average sync duration

## Security Considerations

### CSRF Protection
All endpoints require CSRF tokens for security.

### Input Validation
- Validates wallet address format
- Checks user existence before sync
- Sanitizes error messages

### Rate Limiting
- Prevents abuse of sync endpoints
- Implements request timeouts
- Respects blockchain RPC limits

## Troubleshooting

### Common Issues

1. **Balance Not Updating**
   - Check Solana RPC endpoint connectivity
   - Verify wallet address format
   - Check if user has USDC token account

2. **Sync Timeouts**
   - Increase timeout in middleware options
   - Check network connectivity
   - Verify RPC endpoint performance

3. **Invalid Wallet Addresses**
   - Validate wallet address format
   - Check for typos in wallet addresses
   - Ensure addresses are valid Solana public keys

### Debug Commands
```bash
# Check specific user balance
curl -X GET http://localhost:3000/api/users/1

# Force sync specific user
curl -X POST http://localhost:3000/api/users/1/sync-balance

# Check sync statistics
curl -X GET http://localhost:3000/api/users/sync-stats
```

## Future Enhancements

### Planned Features
- Support for additional SPL tokens
- Real-time balance notifications
- Advanced caching strategies
- Balance history tracking
- Multi-network support

### Integration Opportunities
- Real-time balance updates via WebSocket
- Mobile app push notifications
- Third-party wallet integrations
- Advanced analytics and reporting




# Boosted Yield Investment System

This document describes the implementation of the boosted yield investment system using the Lulo.fi API, allowing users to invest USDC to earn yield with both protected and boosted (regular) methods.

## 🔧 Overview

The boosted yield investment system provides:

- **Lulo.fi Integration**: Direct integration with Lulo.fi API for yield investments
- **Protected Investments**: Lower risk, guaranteed yield investments
- **Boosted (Regular) Investments**: Higher risk, higher yield investments
- **Referrer System**: Support for referral programs and bonuses
- **Multisig Governance**: All investments require multisig approval
- **Complete Audit Trail**: All investment operations are recorded and tracked
- **Real-time Data**: Live pool data, rates, and account information

## 📊 How It Works

### Investment Types

1. **Protected Investments (PUSD)**:
   - Lower risk, guaranteed yield
   - Fixed APY with capital protection
   - Immediate withdrawal capability

2. **Boosted Investments (LUSD)**:
   - Higher risk, higher yield
   - Variable APY based on market conditions
   - Cooldown period for withdrawals

3. **Combined Investments**:
   - Mix of both protected and boosted
   - Diversified risk profile
   - Flexible allocation

### Investment Flow

1. **User Initiates Investment**: User requests investment via API
2. **Lulo API Integration**: System generates Lulo.fi transaction/instructions
3. **Multisig Proposal**: Investment creates multisig proposal for approval
4. **Approval Process**: Multisig members review and approve investment
5. **Execution**: Approved investment is executed on Lulo.fi
6. **Status Tracking**: Investment status is tracked in database

## 🗄️ Database Schema

### Yield Investment Table
```sql
CREATE TABLE yield_investments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,                    -- User who made the investment
  owner VARCHAR NOT NULL,                      -- Owner wallet address
  type VARCHAR NOT NULL,                       -- Investment type
  amount DECIMAL(18,8) NOT NULL,               -- Total amount
  regular_amount DECIMAL(18,8),                -- Regular (boosted) amount
  protected_amount DECIMAL(18,8),              -- Protected amount
  status VARCHAR DEFAULT 'PENDING',            -- Investment status
  transaction_hash VARCHAR,                    -- Blockchain transaction hash
  lulo_account VARCHAR,                        -- Lulo account address
  referrer_account VARCHAR,                    -- Referrer account address
  proposal_id INTEGER,                         -- Associated multisig proposal ID
  notes TEXT,                                  -- Optional notes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Investment Types
- `PROTECTED`: Protected investment only
- `REGULAR`: Boosted investment only
- `BOTH`: Combined investment
- `PROTECTED_WITHDRAWAL`: Protected withdrawal
- `REGULAR_WITHDRAWAL_INIT`: Initiate boosted withdrawal
- `REGULAR_WITHDRAWAL_COMPLETE`: Complete boosted withdrawal
- `REFERRER_INIT`: Initialize referrer account

### Investment Status
- `PENDING`: Investment created, pending multisig approval
- `PENDING_APPROVAL`: Awaiting multisig approval
- `COMPLETED`: Investment successfully executed
- `FAILED`: Investment failed
- `CANCELLED`: Investment cancelled

## 🔌 API Endpoints

### Investment Operations

#### Initialize Referrer Account
```http
POST /api/boosted-yield/initialize-referrer
Content-Type: application/json

{
  "userId": 123,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "feePayer": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "notes": "Initialize referrer for user"
}
```

#### Create Investment (Deposit)
```http
POST /api/boosted-yield/deposit
Content-Type: application/json

{
  "userId": 123,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "type": "BOTH",
  "amount": 1000,
  "regularAmount": 600,
  "protectedAmount": 400,
  "referrer": "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb",
  "notes": "Diversified yield investment"
}
```

#### Withdraw Protected
```http
POST /api/boosted-yield/withdraw-protected
Content-Type: application/json

{
  "userId": 123,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "amount": 100,
  "notes": "Emergency withdrawal"
}
```

#### Initiate Regular Withdrawal
```http
POST /api/boosted-yield/initiate-regular-withdrawal
Content-Type: application/json

{
  "userId": 123,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "amount": 200,
  "notes": "Initiate boosted withdrawal"
}
```

#### Complete Regular Withdrawal
```http
POST /api/boosted-yield/complete-regular-withdrawal
Content-Type: application/json

{
  "userId": 123,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "pendingWithdrawalId": 1,
  "notes": "Complete boosted withdrawal"
}
```

### Data Retrieval

#### Get Account Data
```http
GET /api/boosted-yield/account/34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB
```

#### Get Pool Data
```http
GET /api/boosted-yield/pools?owner=34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB
```

#### Get Current Rates
```http
GET /api/boosted-yield/rates?owner=34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB
```

#### Get Pending Withdrawals
```http
GET /api/boosted-yield/pending-withdrawals/34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB
```

#### Get User Investments
```http
GET /api/boosted-yield/user/123
```

#### Get Investment by ID
```http
GET /api/boosted-yield/investment/456
```

#### Update Investment Status
```http
PUT /api/boosted-yield/investment/456/status
Content-Type: application/json

{
  "status": "COMPLETED",
  "transactionHash": "5J7X8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0"
}
```

#### Get Configuration Status
```http
GET /api/boosted-yield/config/status
```

## 🔧 Configuration

### Environment Variables

```bash
# Lulo.fi API key for boosted yield investments
LULO_API_KEY="your-lulo-api-key-here"

# Optional: Priority fee in lamports (default: 50000)
LULO_PRIORITY_FEE="50000"
```

### Lulo.fi API Integration

The system integrates with Lulo.fi API endpoints using the built-in `fetch` API (Node.js 18+):

- **Initialize Referrer**: `/v1/generate.instructions.initializeReferrer`
- **Deposit**: `/v1/generate.instructions.deposit`
- **Withdraw Protected**: `/v1/generate.instructions.withdrawProtected`
- **Initiate Regular Withdraw**: `/v1/generate.instructions.initiateRegularWithdraw`
- **Complete Regular Withdrawal**: `/v1/generate.instructions.completeRegularWithdrawal`
- **Get Account**: `/v1/account.getAccount`
- **Get Pools**: `/v1/pool.getPools`
- **Get Rates**: `/v1/rates.getRates`
- **Get Pending Withdrawals**: `/v1/account.withdrawals.listPendingWithdrawals`
- **Get Referrer**: `/v1/referral.getReferrer`

## 🏗️ Architecture

### Service Layer

1. **LuloApiService**: Handles all Lulo.fi API interactions
2. **BoostedYieldService**: Manages boosted yield investment operations
3. **MultisigProposalService**: Creates multisig proposals for investments
4. **OnDemandMultisigService**: Ensures users have multisig accounts

### Data Flow

```
User Request → BoostedYieldService → LuloApiService → Lulo.fi API
     ↓
MultisigProposalService → Database → Multisig Approval
     ↓
Execution → Status Update → User Notification
```

## 🔒 Security Features

### Multisig Governance
- All investments require multisig approval
- On-demand multisig creation for new users
- Time lock enforcement for enhanced security
- Complete audit trail of all operations

### API Security
- CSRF protection on all endpoints
- Rate limiting and speed limiting
- Input validation and sanitization
- Secure API key management

### Data Protection
- Encrypted API communications
- Secure transaction data storage
- User data anonymization support
- Complete audit logging

## 📈 Monitoring and Analytics

### Investment Tracking
- Real-time investment status
- Historical investment data
- Performance metrics
- Risk analysis

### Pool Monitoring
- Live pool data and rates
- Liquidity tracking
- APY monitoring
- Market condition analysis

### User Analytics
- Investment patterns
- Risk preferences
- Performance tracking
- Referral statistics

## 🚀 Usage Examples

### Basic Investment Flow

1. **Initialize Referrer** (Optional):
```javascript
const response = await fetch('/api/boosted-yield/initialize-referrer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    owner: 'user-wallet-address',
    feePayer: 'user-wallet-address'
  })
});
```

2. **Create Investment**:
```javascript
const response = await fetch('/api/boosted-yield/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    owner: 'user-wallet-address',
    type: 'BOTH',
    amount: 1000,
    regularAmount: 600,
    protectedAmount: 400,
    referrer: 'referrer-wallet-address'
  })
});
```

3. **Monitor Investment**:
```javascript
const investments = await fetch('/api/boosted-yield/user/123');
const poolData = await fetch('/api/boosted-yield/pools');
const rates = await fetch('/api/boosted-yield/rates');
```

### Withdrawal Flow

1. **Protected Withdrawal** (Immediate):
```javascript
const response = await fetch('/api/boosted-yield/withdraw-protected', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    owner: 'user-wallet-address',
    amount: 100
  })
});
```

2. **Boosted Withdrawal** (Two-step process):
```javascript
// Step 1: Initiate withdrawal
const initResponse = await fetch('/api/boosted-yield/initiate-regular-withdrawal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    owner: 'user-wallet-address',
    amount: 200
  })
});

// Step 2: Complete withdrawal (after cooldown period)
const completeResponse = await fetch('/api/boosted-yield/complete-regular-withdrawal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    owner: 'user-wallet-address',
    pendingWithdrawalId: 1
  })
});
```

## 🔧 Error Handling

### Common Error Scenarios

1. **API Configuration Errors**:
   - Missing LULO_API_KEY
   - Invalid API key
   - Network connectivity issues

2. **Investment Errors**:
   - Insufficient balance
   - Invalid investment type
   - Amount validation failures

3. **Multisig Errors**:
   - No multisig found
   - Insufficient approvals
   - Time lock violations

4. **Lulo.fi API Errors**:
   - Rate limiting
   - Invalid parameters
   - Service unavailability

### Error Response Format

```json
{
  "message": "Error description",
  "error": "Error Type",
  "details": "Detailed error information"
}
```

## 📊 Performance Considerations

### Optimization Strategies

1. **Caching**: Pool data and rates are cached for performance
2. **Rate Limiting**: API calls are rate-limited to prevent abuse
3. **Batch Operations**: Multiple operations can be batched together
4. **Async Processing**: Long-running operations are processed asynchronously

### Monitoring

1. **API Response Times**: Track Lulo.fi API response times
2. **Success Rates**: Monitor investment success rates
3. **Error Rates**: Track and analyze error patterns
4. **User Activity**: Monitor user engagement and patterns

## 🔮 Future Enhancements

### Planned Features

1. **Advanced Analytics**: Enhanced reporting and analytics
2. **Automated Strategies**: AI-powered investment strategies
3. **Portfolio Management**: Advanced portfolio tracking
4. **Risk Management**: Enhanced risk assessment tools
5. **Mobile Support**: Mobile-optimized interfaces

### Integration Opportunities

1. **DeFi Protocols**: Integration with other DeFi protocols
2. **Cross-chain Support**: Multi-chain investment support
3. **Institutional Features**: Enterprise-grade features
4. **Compliance Tools**: Regulatory compliance features

## 📚 Additional Resources

- [Lulo.fi API Documentation](https://docs.lulo.fi/)
- [Multisig Governance System](./MULTISIG_PROPOSAL_SYSTEM.md)
- [Database Schema](./prisma/schema.prisma)
- [Environment Configuration](./ENVIRONMENT_VARIABLES.md)
- [Security Features](./ERROR_HANDLING_SYSTEM.md)

## 🆘 Support

For technical support or questions about the boosted yield investment system:

1. Check the API documentation and examples
2. Review error logs and status codes
3. Verify environment configuration
4. Contact the development team for assistance

---

**Note**: This system requires proper configuration of Lulo.fi API credentials and multisig governance setup. Ensure all security measures are in place before deploying to production.

# First Name Transfer Fee System

This document describes the fee system implemented for first-name-based transfers in the Fusee backend.

## 🔧 Overview

The first name transfer system now includes automatic fee deduction for every transfer:

- **Fee Rate**: 0.001% (0.00001) of the transfer amount
- **Fee Collection**: Fees are automatically collected and stored in the fee wallet
- **Balance Validation**: Users must have enough balance to cover both the transfer amount and the fee
- **Transparent Process**: Fee details are included in all transfer responses

## 📊 How It Works

### Transfer Process with Fees
1. **User Initiates Transfer**: User specifies receiver's first name and amount
2. **Fee Calculation**: 0.001% fee is calculated using `FeeService.calculateFee()`
3. **Balance Validation**: System checks if sender has sufficient balance (amount + fee)
4. **Fee Deduction**: Both transfer amount and fee are deducted from sender's balance
5. **Transfer Execution**: Receiver gets the net amount (amount - fee)
6. **Fee Collection**: Fee is collected and stored in the fee wallet system
7. **Transaction Record**: Complete transfer record with fee details is stored

### Fee Calculation Example
```
Transfer Amount: 100 SOL
Fee Rate: 0.001% (0.00001)
Fee Amount: 100 * 0.00001 = 0.001 SOL
Net Amount: 100 - 0.001 = 99.999 SOL
Total Deducted: 100 + 0.001 = 100.001 SOL
```

## 🗄️ Database Schema

### Transfer Table
```sql
CREATE TABLE transfers (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  amount DECIMAL(18,8) NOT NULL,        -- Original transfer amount
  fee DECIMAL(18,8) NOT NULL,           -- Fee amount deducted
  net_amount DECIMAL(18,8) NOT NULL,    -- Amount received by receiver
  currency VARCHAR DEFAULT 'SOL',
  status transfer_status DEFAULT 'PENDING',
  transaction_hash VARCHAR,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Fee Table
```sql
CREATE TABLE fees (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL,
  vault_id INTEGER NOT NULL,
  amount DECIMAL(18,8) NOT NULL,        -- Fee amount collected
  currency VARCHAR DEFAULT 'SOL',
  fee_rate DECIMAL(8,6) NOT NULL,       -- Fee rate used (0.00001)
  status fee_status DEFAULT 'COLLECTED',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 API Endpoints

### Create First Name Transfer (with fees)
```http
POST /api/transfers
Content-Type: application/json

{
  "senderId": 1,
  "receiverFirstName": "Bob",
  "amount": 100.0,
  "currency": "SOL",
  "notes": "Payment for services"
}
```

**Response:**
```json
{
  "message": "Internal transfer completed successfully",
  "transfer": {
    "id": 1,
    "senderId": 1,
    "receiverId": 2,
    "amount": 100.0,
    "fee": 0.001,
    "netAmount": 99.999,
    "currency": "SOL",
    "status": "COMPLETED",
    "transactionHash": "INTERNAL_1234567890_abc123",
    "notes": "Payment for services"
  },
  "balances": {
    "sender": {
      "firstName": "Alice",
      "balance": 899.999
    },
    "receiver": {
      "firstName": "Bob",
      "balance": 199.999
    }
  },
  "fee": {
    "amount": 0.001,
    "rate": "0.001%",
    "netAmount": 99.999
  },
  "note": "This is an internal balance transfer, not a real Solana transaction"
}
```

### Validate Transfer (including fees)
```http
POST /api/transfers/validate
Content-Type: application/json

{
  "userId": 1,
  "amount": 100.0
}
```

**Response:**
```json
{
  "canTransfer": true,
  "currentBalance": 1000.0,
  "requiredAmount": 100.001,
  "shortfall": 0
}
```

## ⚙️ Configuration

### Fee Settings
- **Fee Rate**: 0.001% (0.00001) - configured in `FeeService`
- **Minimum Fee**: 0 SOL (no minimum fee)
- **Calculation**: `fee = amount * 0.00001`
- **Net Amount**: `netAmount = amount - fee`
- **Total Required**: `totalRequired = amount + fee`

### Balance Constraints
- **Spending Limit**: Users cannot transfer more than their current balance
- **Fee Inclusion**: Balance check includes both transfer amount and fee
- **Real-time Validation**: Balance is validated before each transfer
- **Atomic Updates**: Balance updates are atomic to prevent race conditions

## 🛡️ Security Features

### Fee Protection
- **Automatic Deduction**: Fees are automatically deducted from sender
- **Balance Validation**: Prevents transfers when insufficient balance for amount + fee
- **Fee Collection**: Fees are properly collected and stored in fee wallet
- **Audit Trail**: All fee transactions are recorded in the database

### Transaction Integrity
- **Atomic Operations**: Both balance updates and fee collection are atomic
- **Complete Audit Trail**: All transfers and fees are permanently stored
- **Status Tracking**: Transfer and fee status are tracked throughout the process
- **Error Handling**: Graceful handling of fee collection errors

## 📊 Monitoring and Statistics

### Fee Statistics
- **Total Fees Collected**: Sum of all fees collected from transfers
- **Average Fee**: Mean fee amount per transfer
- **Fee Rate**: Current fee rate (0.001%)
- **Fee Wallet Balance**: Current balance in the fee wallet

### Transfer Statistics
- **Total Transfers**: Count of all transfers made
- **Total Volume**: Sum of all transfer amounts
- **Total Fees**: Sum of all fees collected
- **Net Transfers**: Sum of all net amounts received

## 🚨 Error Handling

### Common Errors

#### Insufficient Balance (including fees)
```json
{
  "message": "Insufficient balance. Current: 100, Required: 100.001 (amount: 100 + fee: 0.001)",
  "error": "Bad Request"
}
```

#### Fee Collection Error
```json
{
  "message": "Error collecting fee for first-name transfer: [error details]",
  "error": "Fee Collection Failed"
}
```

### Error Recovery
- **Transfer Success**: Transfer proceeds even if fee collection fails (logged)
- **Graceful Degradation**: System continues operating on fee collection errors
- **Detailed Logging**: Comprehensive error logging for debugging
- **User Feedback**: Clear error messages for users

## 🔧 Implementation Details

### FeeService Integration
The `FirstNameTransferService` now integrates with the `FeeService`:

```typescript
// Calculate fee using FeeService
const { fee, netAmount } = FeeService.calculateFee(amount);

// Collect fee after successful transfer
await FeeService.processTransferFee(
  result.transfer.id,
  amount,
  currency
);
```

### Balance Validation
```typescript
// Check balance including fees
const totalRequired = amount + fee;
if (currentBalance < totalRequired) {
  throw new Error(`Insufficient balance. Current: ${currentBalance}, Required: ${totalRequired}`);
}
```

### Database Updates
```typescript
// Deduct amount + fee from sender
balance: { decrement: totalRequired }

// Receiver gets net amount
balance: { increment: netAmount }
```

## 💡 Benefits

### For Users
- **Transparent Fees**: Clear fee information in all responses
- **Fair Pricing**: Low 0.001% fee rate
- **Balance Clarity**: Validation shows total required amount
- **Complete Records**: Full audit trail of all transactions

### For System
- **Revenue Generation**: Automatic fee collection
- **Cost Recovery**: Covers system operational costs
- **Scalability**: Fee system scales with transaction volume
- **Monitoring**: Complete fee tracking and reporting

This fee system ensures that every first-name transfer contributes to the system's operational costs while maintaining a low, fair fee rate for users.

# Multisig Transfer System

This document describes the multisig transfer system that requires multisig approval for all wallet transfers between users in the app.

## 🔧 Overview

The multisig transfer system provides:
- **Automatic Detection**: Identifies transfers between users that require multisig approval
- **Proposal System**: Creates transfer proposals that must be approved by multisig members
- **Approval Workflow**: Multi-step process for approving and executing transfers
- **Security Enhancement**: Adds an extra layer of security for internal transfers
- **Audit Trail**: Complete tracking of all transfer proposals and approvals

## 📊 How It Works

### Transfer Detection
- **User Wallet Check**: Verifies if source wallet belongs to a user
- **Automatic Routing**: All transfers from user wallets are automatically routed to multisig system
- **External Transfers**: External transfers from users require multisig approval
- **External to User**: External transfers to users do not require multisig approval

### Proposal Workflow
1. **Transfer Request**: User initiates transfer from their wallet (to user or external)
2. **Proposal Creation**: System creates multisig transfer proposal
3. **Multisig Approval**: Required number of multisig members must approve
4. **Execution**: Any approved member can execute the transfer
5. **Completion**: Transfer is executed on blockchain

### Security Features
- **Mandatory Approval**: All transfers from user wallets require multisig approval
- **External Transfer Security**: External transfers from users are secured through multisig
- **Activity Tracking**: All proposal actions update admin activity timestamps
- **Audit Trail**: Complete history of all proposals and approvals
- **Status Management**: Clear status tracking throughout the process

## 🗄️ Database Schema

### MultisigTransferProposal Table
```sql
CREATE TABLE multisig_transfer_proposals (
  id SERIAL PRIMARY KEY,
  from_wallet VARCHAR NOT NULL,           -- Source wallet address
  to_wallet VARCHAR NOT NULL,             -- Destination wallet address
  amount DECIMAL(18,8) NOT NULL,          -- Transfer amount
  net_amount DECIMAL(18,8) NOT NULL,      -- Amount after fee deduction
  fee DECIMAL(18,8) NOT NULL,             -- Fee amount
  currency VARCHAR DEFAULT 'SOL',         -- Currency type
  status multisig_transfer_status DEFAULT 'PENDING', -- Proposal status
  requested_by VARCHAR NOT NULL,          -- Public key of requester
  multisig_pda VARCHAR NOT NULL,          -- Multisig PDA for approval
  proposal_id VARCHAR,                    -- External proposal ID
  transaction_hash VARCHAR,               -- Blockchain transaction hash
  notes TEXT,                             -- Optional transfer notes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### MultisigTransferStatus Enum
```sql
CREATE TYPE multisig_transfer_status AS ENUM (
  'PENDING',    -- Awaiting approval
  'APPROVED',   -- Approved by required members
  'REJECTED',   -- Rejected by a member
  'EXECUTED',   -- Successfully executed
  'FAILED'      -- Execution failed
);
```

## 🚀 API Endpoints

### Create Transfer Proposal
```http
POST /api/multisig-transfers/propose
Content-Type: application/json

{
  "fromWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "toWallet": "FeeWallet1234567890123456789012345678901234567890",
  "amount": 1.5,
  "currency": "SOL",
  "notes": "Payment for services",
  "requestedBy": "ABC123..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer proposal created successfully",
  "data": {
    "id": 1,
    "fromWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "toWallet": "FeeWallet1234567890123456789012345678901234567890",
    "amount": 1.5,
    "netAmount": 1.499985,
    "fee": 0.000015,
    "currency": "SOL",
    "status": "PENDING",
    "requestedBy": "ABC123...",
    "multisigPda": "MultisigPDA123...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Transfer Proposals
```http
GET /api/multisig-transfers/proposals?status=PENDING
```

**Response:**
```json
{
  "success": true,
  "data": {
    "proposals": [
      {
        "id": 1,
        "fromWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "toWallet": "FeeWallet1234567890123456789012345678901234567890",
        "amount": 1.5,
        "status": "PENDING"
      }
    ],
    "count": 1
  }
}
```

### Approve Transfer Proposal
```http
POST /api/multisig-transfers/proposals/1/approve
Content-Type: application/json

{
  "approverPublicKey": "DEF456..."
}
```

### Reject Transfer Proposal
```http
POST /api/multisig-transfers/proposals/1/reject
Content-Type: application/json

{
  "rejectorPublicKey": "GHI789...",
  "reason": "Insufficient funds"
}
```

### Execute Transfer Proposal
```http
POST /api/multisig-transfers/proposals/1/execute
Content-Type: application/json

{
  "executorPublicKey": "JKL012..."
}
```

### Get Transfer Statistics
```http
GET /api/multisig-transfers/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "pending": 3,
    "approved": 2,
    "rejected": 1,
    "executed": 4,
    "failed": 0
  }
}
```

### Check Transfer Requirement
```http
GET /api/multisig-transfers/check-requirement?fromWallet=ABC123...&toWallet=DEF456...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requiresApproval": true,
    "fromWallet": "ABC123...",
    "toWallet": "DEF456..."
  }
}
```

## 💰 Deposit Processing

### Deposits - No Multisig Required
- **Processing**: Immediate and automatic
- **Approval**: Not required - deposits are processed instantly
- **Security**: Safe - incoming funds are typically secure
- **User Experience**: Seamless - no delays or waiting periods
- **API Endpoint**: `POST /api/vault/deposit`

### Why Deposits Don't Need Multisig
1. **Incoming Funds**: Deposits are funds coming INTO the system
2. **User Benefit**: Users receive funds, not lose them
3. **Immediate Access**: Users expect immediate access to deposited funds
4. **Low Risk**: Incoming transfers pose minimal security risk
5. **Better UX**: No approval delays for user deposits

## 🔄 Transfer Scenarios

### Transfer Types and Requirements

#### User-to-User Transfers
- **Requirement**: ✅ Requires multisig approval
- **Description**: Transfers between two users in the app
- **Security**: High - both parties are known users

#### User-to-External Transfers
- **Requirement**: ✅ Requires multisig approval
- **Description**: Transfers from user to external wallet
- **Security**: High - outgoing transfers from users are secured

#### External-to-User Transfers (Deposits)
- **Requirement**: ❌ No multisig approval required
- **Description**: Transfers from external wallet to user (deposits)
- **Security**: Medium - incoming transfers are typically safe
- **Processing**: Immediate - no delays or approvals needed

#### External-to-External Transfers
- **Requirement**: ❌ No multisig approval required
- **Description**: Transfers between external wallets
- **Security**: Low - not managed by the app

## 💰 Deposit Workflow

### 1. Deposit Initiation
```javascript
// User makes a deposit (immediate processing)
const response = await fetch('/api/vault/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 1,
    amount: 5.0,
    currency: 'SOL',
    notes: 'Deposit from external wallet'
  })
});

// Response is immediate - no multisig required
const data = await response.json();
console.log('Deposit completed:', data.deposit);
```

### 2. Deposit Processing
1. **Validation**: User exists and amount is valid
2. **Record Creation**: Deposit record created in database
3. **Balance Update**: User and vault balances updated immediately
4. **Completion**: Deposit marked as completed
5. **Response**: Success response sent to user

## 🔄 Transfer Workflow

### 1. Transfer Initiation
```javascript
// User attempts to transfer between user wallets
const response = await fetch('/api/wallet-transfers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromWallet: 'userWallet1',
    toWallet: 'userWallet2',
    amount: 1.5,
    requestedBy: 'adminPublicKey'
  })
});

// Response indicates multisig approval required
if (response.status === 202) {
  const data = await response.json();
  console.log('Transfer proposal created:', data.data.proposalId);
}
```

### 2. Proposal Approval
```javascript
// Multisig member approves the proposal
const approvalResponse = await fetch('/api/multisig-transfers/proposals/1/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    approverPublicKey: 'memberPublicKey'
  })
});
```

### 3. Transfer Execution
```javascript
// Any approved member executes the transfer
const executionResponse = await fetch('/api/multisig-transfers/proposals/1/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    executorPublicKey: 'memberPublicKey'
  })
});
```

## ⚙️ Configuration

### Fee Calculation
- **Fee Rate**: 0.001% (0.00001)
- **Minimum Fee**: 0 SOL
- **Calculation**: `fee = amount * 0.00001`
- **Net Amount**: `netAmount = amount - fee`

### Multisig Requirements
- **User Detection**: Checks if wallet belongs to user in database
- **Approval Threshold**: Based on user's multisig configuration
- **Activity Tracking**: Updates admin activity on all actions
- **Time Lock**: Respects user's multisig time lock settings

## 🛡️ Security Features

### Automatic Detection
- **User Wallet Verification**: Checks database for user ownership
- **Transfer Routing**: Automatically routes user-to-user transfers to multisig
- **External Bypass**: External transfers bypass multisig requirement

### Approval Process
- **Multisig Validation**: Uses user's multisig configuration
- **Member Verification**: Ensures approver is valid multisig member
- **Status Management**: Prevents invalid state transitions

### Audit Trail
- **Complete History**: All proposals and actions are logged
- **Activity Tracking**: Updates admin activity timestamps
- **Status Tracking**: Clear status progression throughout workflow

## 📊 Monitoring and Statistics

### Proposal Statistics
- **Total Proposals**: Count of all transfer proposals
- **Status Breakdown**: Count by status (pending, approved, etc.)
- **Success Rate**: Percentage of successful executions
- **Average Processing Time**: Time from proposal to execution

### Activity Monitoring
- **Admin Activity**: Tracks when admins interact with proposals
- **Inactivity Detection**: Monitors for inactive admins
- **Performance Metrics**: Response times and success rates

## 🚨 Error Handling

### Common Errors

#### Transfer Not Between Users
```json
{
  "success": false,
  "error": "Transfer does not require multisig approval (not between users)"
}
```

#### Missing Required Fields
```json
{
  "success": false,
  "error": "Missing required fields: fromWallet, toWallet, amount, requestedBy"
}
```

#### Invalid Proposal Status
```json
{
  "success": false,
  "error": "Proposal must be approved before execution"
}
```

#### User Without Multisig
```json
{
  "success": false,
  "error": "Source user does not have multisig configured"
}
```

### Error Recovery
- **Graceful Degradation**: System continues operating on errors
- **Detailed Logging**: Comprehensive error logging for debugging
- **Status Updates**: Failed proposals are marked appropriately
- **Retry Logic**: Failed executions can be retried

## 🔧 Maintenance

### Regular Tasks
- **Monitor Proposals**: Check for stuck or failed proposals
- **Review Statistics**: Monitor transfer patterns and success rates
- **Clean Up**: Archive old completed proposals
- **Update Thresholds**: Adjust multisig requirements as needed

### Database Maintenance
- **Index Optimization**: Ensure efficient query performance
- **Data Archival**: Move old proposals to archive tables
- **Backup**: Regular backups of proposal data
- **Cleanup**: Remove test proposals and old data

## 📝 Best Practices

### Proposal Management
- **Clear Documentation**: Use descriptive notes for proposals
- **Timely Approval**: Process proposals promptly
- **Status Monitoring**: Regularly check proposal status
- **Error Handling**: Address failed proposals quickly

### Security
- **Access Control**: Limit who can approve/execute proposals
- **Audit Reviews**: Regularly review proposal history
- **Member Management**: Keep multisig membership current
- **Activity Monitoring**: Watch for unusual patterns

### Performance
- **Efficient Queries**: Use appropriate database indexes
- **Batch Operations**: Process multiple proposals efficiently
- **Caching**: Cache frequently accessed data
- **Monitoring**: Track system performance metrics

This system ensures that all transfers between users in the app are properly secured through multisig approval, providing an additional layer of security and accountability for internal transfers.

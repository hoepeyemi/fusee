# Multisig Proposal System

This document describes the implementation of multisig transaction proposals for wallet transfers and external transfers. All transfers now require multisig approval before execution.

## 🔧 Overview

The multisig proposal system provides:

- **Proposal Creation**: All transfers create proposals in the multisig PDA
- **Approval Process**: Multisig members must approve proposals
- **Execution Control**: Only approved proposals can be executed
- **Complete Audit**: Full proposal and approval history
- **Flexible Thresholds**: Configurable approval requirements

## 🏗️ System Architecture

### **Transfer Flow with Multisig Proposals**
```
User Request → Create Proposal → Multisig Approval → Execute Transfer
```

### **Proposal States**
1. **PENDING** - Proposal created, awaiting approval
2. **APPROVED** - Sufficient approvals received
3. **EXECUTED** - Transfer completed
4. **REJECTED** - Proposal rejected by member

## 📊 **Updated Transfer Endpoints**

### **Wallet Transfers** (Updated)
```http
POST /api/wallet-transfers/real-fees
```
**New Behavior**:
- Creates multisig proposal instead of immediate transfer
- Returns proposal information
- Transfer status: `PENDING_APPROVAL`

**New Response**:
```json
{
  "message": "Wallet transfer proposal created successfully",
  "proposalId": 1,
  "multisigPda": "MultisigPDA123...",
  "transactionIndex": "1234567890",
  "status": "PENDING",
  "fee": 0.000015,
  "netAmount": 1.499985,
  "currency": "SOL",
  "note": "Transfer is pending multisig approval"
}
```

### **External Transfers** (Updated)
```http
POST /api/external-transfers/real-fees
```
**New Behavior**:
- Creates multisig proposal instead of immediate transfer
- Returns proposal information
- Transfer status: `PENDING_APPROVAL`

**New Response**:
```json
{
  "message": "External transfer proposal created successfully",
  "proposalId": 2,
  "multisigPda": "MultisigPDA123...",
  "transactionIndex": "1234567891",
  "status": "PENDING",
  "fee": 0.00002,
  "netAmount": 1.99998,
  "currency": "SOL",
  "note": "Transfer is pending multisig approval"
}
```

## 🏛️ **Multisig Proposal Management**

### **1. Get Pending Proposals**
```http
GET /api/multisig-proposals?multisigPda=MultisigPDA123...
```
**Purpose**: Get all pending proposals for a multisig
**Response**:
```json
{
  "proposals": [
    {
      "id": 1,
      "status": "PENDING",
      "fromWallet": "UserWallet123...",
      "toWallet": "DestinationWallet123...",
      "amount": 1.5,
      "currency": "SOL",
      "memo": "Wallet transfer: 1.5 SOL",
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ],
  "count": 1
}
```

### **2. Approve Proposal**
```http
POST /api/multisig-proposals/{proposalId}/approve
```
**Purpose**: Approve a multisig proposal
**Body**:
```json
{
  "memberPublicKey": "MemberPublicKey123..."
}
```
**Response**:
```json
{
  "success": true,
  "message": "Proposal approved successfully"
}
```

### **3. Reject Proposal**
```http
POST /api/multisig-proposals/{proposalId}/reject
```
**Purpose**: Reject a multisig proposal
**Body**:
```json
{
  "memberPublicKey": "MemberPublicKey123..."
}
```
**Response**:
```json
{
  "success": true,
  "message": "Proposal rejected successfully"
}
```

### **4. Execute Proposal**
```http
POST /api/multisig-proposals/{proposalId}/execute
```
**Purpose**: Execute an approved proposal
**Body**:
```json
{
  "executorPublicKey": "ExecutorPublicKey123..."
}
```
**Response**:
```json
{
  "success": true,
  "message": "Proposal executed successfully",
  "transactionHash": "EXEC_1234567890_abc123"
}
```

### **5. Get Proposal Status**
```http
GET /api/multisig-proposals/{proposalId}/status
```
**Purpose**: Get detailed proposal status
**Response**:
```json
{
  "id": 1,
  "status": "APPROVED",
  "fromWallet": "UserWallet123...",
  "toWallet": "DestinationWallet123...",
  "amount": 1.5,
  "currency": "SOL",
  "memo": "Wallet transfer: 1.5 SOL",
  "transactionHash": null,
  "approvals": 2,
  "threshold": 2,
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:05:00Z"
}
```

## 🔄 **Proposal Workflow**

### **1. Proposal Creation**
- User initiates transfer
- System creates multisig proposal
- Transfer record created with `PENDING_APPROVAL` status
- Proposal stored in multisig PDA

### **2. Approval Process**
- Multisig members review proposal
- Members approve or reject proposal
- System tracks approval count
- When threshold reached, proposal becomes `APPROVED`

### **3. Execution**
- Any multisig member can execute approved proposal
- System simulates transaction execution
- Transfer status updated to `COMPLETED`
- Transaction hash generated

### **4. Rejection**
- Any member can reject proposal
- Proposal status becomes `REJECTED`
- Transfer status remains `PENDING_APPROVAL`

## 🗄️ **Database Schema Updates**

### **New Status Values**
```sql
-- WalletTransferStatus
enum WalletTransferStatus {
  PENDING
  PENDING_APPROVAL  -- New status for multisig approval
  COMPLETED
  FAILED
  CANCELLED
}

-- ExternalTransferStatus
enum ExternalTransferStatus {
  PENDING
  PENDING_APPROVAL  -- New status for multisig approval
  COMPLETED
  FAILED
  CANCELLED
}
```

### **MultisigTransaction Table**
```sql
CREATE TABLE multisig_transactions (
  id SERIAL PRIMARY KEY,
  multisig_id INTEGER NOT NULL,
  transaction_index BIGINT NOT NULL,
  from_wallet VARCHAR NOT NULL,
  to_wallet VARCHAR NOT NULL,
  amount DECIMAL(18,8) NOT NULL,
  currency VARCHAR DEFAULT 'SOL',
  status VARCHAR DEFAULT 'PENDING',
  transaction_hash VARCHAR,
  memo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **MultisigProposal Table**
```sql
CREATE TABLE multisig_proposals (
  id SERIAL PRIMARY KEY,
  multisig_transaction_id INTEGER NOT NULL,
  proposer_key VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **MultisigApproval Table**
```sql
CREATE TABLE multisig_approvals (
  id SERIAL PRIMARY KEY,
  multisig_transaction_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  approval_type VARCHAR DEFAULT 'APPROVE',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🛡️ **Security Features**

### **Multisig Control**
- **Proposal Required**: All transfers must be proposed
- **Member Approval**: Only multisig members can approve/reject
- **Threshold Enforcement**: Configurable approval requirements
- **Execution Control**: Only approved proposals can be executed

### **Audit Trail**
- **Complete History**: All proposals and approvals tracked
- **Member Activity**: Track which members approved/rejected
- **Timestamps**: Full timeline of proposal lifecycle
- **Transaction Hashes**: Blockchain transaction tracking

### **Access Control**
- **Member Verification**: Only active members can participate
- **Permission Checks**: Verify member permissions
- **Duplicate Prevention**: Prevent duplicate approvals
- **Status Validation**: Ensure proper proposal states

## 📊 **Usage Examples**

### **Complete Transfer Flow**
```bash
# 1. Create wallet transfer proposal
curl -X POST http://localhost:3000/api/wallet-transfers/real-fees \
  -H "Content-Type: application/json" \
  -d '{
    "fromWallet": "UserWallet123...",
    "toWallet": "DestinationWallet123...",
    "amount": 1.5,
    "currency": "SOL",
    "notes": "Payment for services"
  }'

# Response: Proposal created with ID 1

# 2. Get pending proposals
curl "http://localhost:3000/api/multisig-proposals?multisigPda=MultisigPDA123..."

# 3. Approve proposal (by member 1)
curl -X POST http://localhost:3000/api/multisig-proposals/1/approve \
  -H "Content-Type: application/json" \
  -d '{"memberPublicKey": "Member1PublicKey123..."}'

# 4. Approve proposal (by member 2)
curl -X POST http://localhost:3000/api/multisig-proposals/1/approve \
  -H "Content-Type: application/json" \
  -d '{"memberPublicKey": "Member2PublicKey123..."}'

# 5. Execute proposal
curl -X POST http://localhost:3000/api/multisig-proposals/1/execute \
  -H "Content-Type: application/json" \
  -d '{"executorPublicKey": "ExecutorPublicKey123..."}'

# 6. Check proposal status
curl http://localhost:3000/api/multisig-proposals/1/status
```

## 🔧 **Configuration**

### **Multisig Requirements**
- **Active Multisig**: Must have multisig in database
- **Member Configuration**: Multisig must have active members
- **Threshold Setting**: Configure approval threshold
- **Time Lock**: Optional time lock for proposals

### **Environment Variables**
No new environment variables required. Uses existing multisig configuration.

## 🚨 **Error Handling**

### **Common Errors**

#### No Multisig Found
```json
{
  "message": "No main multisig found. Please create a multisig first.",
  "error": "Multisig Not Found"
}
```

#### Member Not Found
```json
{
  "message": "Member not found or inactive",
  "error": "Member Not Found"
}
```

#### Already Approved
```json
{
  "message": "Proposal already approved by this member",
  "error": "Duplicate Approval"
}
```

#### Not Approved
```json
{
  "message": "Proposal must be approved before execution",
  "error": "Not Approved"
}
```

## 📈 **Benefits**

### **Enhanced Security**
- **Multi-Signature Control**: Multiple approvals required
- **No Single Point of Failure**: Distributed decision making
- **Audit Trail**: Complete transaction history
- **Flexible Thresholds**: Configurable approval requirements

### **Better Control**
- **Proposal Review**: Members can review before approval
- **Rejection Capability**: Members can reject suspicious proposals
- **Execution Control**: Only approved proposals execute
- **Member Oversight**: Full visibility into all transfers

### **Operational Benefits**
- **Consistent Interface**: Same API endpoints
- **Backward Compatibility**: Existing integrations work
- **Enhanced Monitoring**: Better visibility into operations
- **Scalable Architecture**: Easy to add new features

## 🔄 **Migration Notes**

### **From Direct Transfers**
- **Automatic Proposals**: All transfers now create proposals
- **Status Updates**: New `PENDING_APPROVAL` status
- **Approval Required**: Transfers require multisig approval
- **Enhanced Security**: Immediate security improvements

### **Backward Compatibility**
- **Same Endpoints**: All existing endpoints work
- **Enhanced Responses**: Additional proposal information
- **Status Changes**: New status values added
- **No Breaking Changes**: Existing integrations continue to work

This multisig proposal system provides enhanced security and control for all transfers while maintaining full backward compatibility! 🎉

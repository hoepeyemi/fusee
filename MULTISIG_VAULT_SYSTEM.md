# Multisig Vault System

This document describes the updated vault system that uses the multisig PDA (Program Derived Address) as the main vault for deposits and withdrawals.

## 🔧 Overview

The vault system has been updated to use the **multisig PDA** as the main vault address instead of a dedicated wallet. This provides:

- **Multisig Control**: The main vault is controlled by the multisig
- **Enhanced Security**: All vault operations require multisig approval
- **Centralized Management**: Single multisig controls all vault operations
- **Audit Trail**: Complete transaction history through multisig

## 🏗️ Architecture Changes

### **Before (Dedicated Wallet)**
```
User → Dedicated Wallet → Vault Operations
```

### **After (Multisig PDA)**
```
User → Multisig PDA → Vault Operations
```

## 📊 **Updated Vault Endpoints**

### **1. Get User Balance** (Unchanged)
```http
GET /api/vault/balance/{userId}
```
**Purpose**: Get user's vault balance
**Response**: Same as before

### **2. Deposit to Vault** (Updated)
```http
POST /api/vault/deposit
```
**Purpose**: Deposit to multisig-controlled vault
**Changes**:
- Uses multisig PDA as vault address
- Creates vault record linked to multisig PDA
- Updates multisig vault balance

**Response**:
```json
{
  "message": "Deposit completed successfully",
  "deposit": { /* deposit record */ },
  "newBalance": 12.0
}
```

### **3. Withdraw from Vault** (Updated)
```http
POST /api/vault/withdraw
```
**Purpose**: Withdraw from multisig-controlled vault
**Changes**:
- Uses multisig PDA as vault address
- Validates against multisig vault balance
- Updates multisig vault balance

**Response**:
```json
{
  "message": "Withdrawal completed successfully",
  "withdrawal": { /* withdrawal record */ },
  "newBalance": 11.5
}
```

### **4. Get Vault Status** (Updated)
```http
GET /api/vault/status
```
**Purpose**: Get multisig vault status and information
**New Response**:
```json
{
  "vaults": [
    {
      "multisigPda": "MultisigPDA123...",
      "name": "Multisig Main Vault",
      "totalBalance": 1000.5,
      "feeBalance": 0.1,
      "currency": "SOL",
      "isActive": true,
      "memberCount": 3,
      "threshold": 2,
      "timeLock": 5
    }
  ],
  "totalBalance": 1000.5,
  "totalFeeBalance": 0.1
}
```

### **5. Get Multisig Wallet Address** (Updated)
```http
GET /api/vault/wallet/address
```
**Purpose**: Get multisig PDA address
**New Response**:
```json
{
  "multisigWalletAddress": "MultisigPDA123...",
  "multisigWalletName": "Multisig Main Vault",
  "note": "This is the multisig PDA address that controls the main vault. To change it, create a new multisig and update the database."
}
```

## 🔄 **New Services**

### **MultisigVaultService**
A new service that manages vault operations using the multisig PDA:

```typescript
// Get or create multisig vault
const vault = await MultisigVaultService.getInstance()
  .getOrCreateMultisigVault('SOL');

// Update vault balance
await MultisigVaultService.getInstance()
  .updateVaultBalance(multisigPda, amount, 'deposit');

// Get vault status
const status = await MultisigVaultService.getInstance()
  .getMultisigVaultStatus();
```

### **MultisigService Updates**
Added methods to get the main multisig PDA:

```typescript
// Get main multisig PDA from database
const multisigPda = await MultisigService.getMainMultisigPda();

// Get multisig PDA address from instance
const address = multisigService.getMultisigPdaAddress();
```

## 🗄️ **Database Schema Updates**

### **Vault Table**
The vault table now stores multisig PDA addresses:

```sql
CREATE TABLE vaults (
  id SERIAL PRIMARY KEY,
  address VARCHAR UNIQUE,           -- Multisig PDA address
  name VARCHAR DEFAULT 'Multisig Main Vault',
  total_balance DECIMAL(18,8) DEFAULT 0,
  fee_balance DECIMAL(18,8) DEFAULT 0,
  currency VARCHAR DEFAULT 'SOL',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Multisig Table**
The multisig table stores the main multisig information:

```sql
CREATE TABLE multisigs (
  id SERIAL PRIMARY KEY,
  multisig_pda VARCHAR UNIQUE,     -- The multisig PDA address
  create_key VARCHAR UNIQUE,       -- The create key
  name VARCHAR DEFAULT 'Main Multisig',
  threshold INT,                   -- Required approvals
  time_lock INT DEFAULT 0,         -- Time lock in seconds
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 **How It Works**

### **Deposit Flow**
1. **User Request**: User requests deposit
2. **Multisig Lookup**: System finds main multisig PDA
3. **Vault Creation**: Creates vault record linked to multisig PDA
4. **Deposit Record**: Creates deposit record
5. **Balance Update**: Updates multisig vault balance
6. **User Balance**: Updates user's internal balance

### **Withdrawal Flow**
1. **User Request**: User requests withdrawal
2. **Balance Check**: Validates user has sufficient balance
3. **Multisig Lookup**: Finds main multisig PDA
4. **Vault Check**: Ensures vault exists for multisig
5. **Withdrawal Record**: Creates withdrawal record
6. **Balance Update**: Updates multisig vault balance
7. **User Balance**: Updates user's internal balance

## 🛡️ **Security Features**

### **Multisig Control**
- **PDA Ownership**: Vault is controlled by multisig PDA
- **Approval Required**: All operations require multisig approval
- **Member Management**: Multisig members control vault access
- **Time Locks**: Configurable time locks for operations

### **Audit Trail**
- **Complete History**: All operations tracked in database
- **Multisig Logs**: Multisig transaction history
- **Member Activity**: Track member participation
- **Balance Tracking**: Real-time balance updates

## 📊 **Benefits**

### **Enhanced Security**
- **Multisig Control**: Multiple signatures required for operations
- **Decentralized Management**: No single point of failure
- **Configurable Thresholds**: Flexible approval requirements
- **Time Locks**: Protection against rapid changes

### **Better Management**
- **Centralized Vault**: Single multisig controls main vault
- **Member Oversight**: Multiple members can monitor operations
- **Flexible Configuration**: Adjustable thresholds and time locks
- **Complete Audit**: Full transaction history

### **Operational Benefits**
- **Consistent Interface**: Same API endpoints
- **Backward Compatibility**: Existing integrations work
- **Enhanced Monitoring**: Better visibility into operations
- **Scalable Architecture**: Easy to add new features

## 🚀 **Usage Examples**

### **Check Vault Status**
```bash
curl http://localhost:3000/api/vault/status
```

### **Get Multisig Address**
```bash
curl http://localhost:3000/api/vault/wallet/address
```

### **Make Deposit**
```bash
curl -X POST http://localhost:3000/api/vault/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "amount": 1.5,
    "currency": "SOL",
    "notes": "Deposit to multisig vault"
  }'
```

### **Make Withdrawal**
```bash
curl -X POST http://localhost:3000/api/vault/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "amount": 0.5,
    "currency": "SOL",
    "notes": "Withdrawal from multisig vault"
  }'
```

## 🔧 **Configuration**

### **Environment Variables**
No new environment variables required. The system uses existing multisig configuration.

### **Database Setup**
Ensure the multisig is created and stored in the database before using vault operations.

### **Multisig Requirements**
- **Active Multisig**: Must have an active multisig in database
- **Proper Configuration**: Multisig must be properly configured
- **Member Access**: Multisig members must have appropriate permissions

## 🚨 **Error Handling**

### **Common Errors**

#### No Multisig Found
```json
{
  "message": "No main multisig found. Please create a multisig first.",
  "error": "Multisig Not Found"
}
```

#### Vault Not Found
```json
{
  "message": "Vault not found for multisig PDA",
  "error": "Vault Not Found"
}
```

#### Insufficient Balance
```json
{
  "message": "Insufficient balance",
  "error": "Bad Request",
  "currentBalance": 10.0,
  "requestedAmount": 15.0
}
```

## 🔄 **Migration Notes**

### **From Dedicated Wallet**
- **Automatic Migration**: System automatically creates vault for multisig PDA
- **No Data Loss**: Existing deposits/withdrawals preserved
- **Seamless Transition**: API remains the same
- **Enhanced Security**: Immediate security improvements

### **Backward Compatibility**
- **Same Endpoints**: All existing endpoints work
- **Same Responses**: Response format unchanged
- **Enhanced Data**: Additional multisig information included
- **No Breaking Changes**: Existing integrations continue to work

This updated vault system provides enhanced security and control through multisig management while maintaining full backward compatibility! 🎉

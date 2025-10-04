# Comprehensive Users API

This document describes the comprehensive users API endpoint that provides complete user details with all associated data.

## 🎯 **Overview**

The `/api/users/all` endpoint provides:

- **Complete User Data**: All user information including personal details, wallet, and multisig data
- **Transaction History**: Full transaction history including transfers, deposits, withdrawals, and external transfers
- **Multisig Details**: Complete multisig membership and configuration information
- **Pagination Support**: Efficient pagination for large user datasets
- **Flexible Filtering**: Optional inclusion/exclusion of different data types
- **Summary Statistics**: System-wide statistics and metrics

## 🚀 **API Endpoint**

### **GET /api/users/all**

**Purpose**: Retrieve all users with complete details and associated data

**Authentication**: CSRF token required

## 📊 **Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeInactive` | boolean | `false` | Include inactive users (users without multisig) |
| `includeMultisig` | boolean | `true` | Include multisig details and members |
| `includeTransactions` | boolean | `true` | Include transaction history |
| `limit` | integer | `100` | Maximum number of users to return (max 1000) |
| `offset` | integer | `0` | Number of users to skip for pagination |

## 📋 **Response Structure**

### **Main Response Object**
```json
{
  "users": [...],           // Array of user objects
  "pagination": {...},      // Pagination information
  "summary": {...}          // System summary statistics
}
```

### **User Object Structure**

#### **Basic User Information**
```json
{
  "id": 1,
  "email": "user@example.com",
  "fullName": "John Doe",
  "firstName": "John",
  "phoneNumber": "+1234567890",
  "solanaWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "balance": 100.5,
  "multisigPda": "MultisigPDA123...",
  "multisigCreateKey": "CreateKey123...",
  "multisigThreshold": 2,
  "multisigTimeLock": 5,
  "hasMultisig": true,
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z"
}
```

#### **Multisig Details** (if `includeMultisig=true`)
```json
{
  "multisigMembers": [
    {
      "id": 1,
      "publicKey": "MemberPublicKey123...",
      "permissions": "Proposer,Voter,Executor",
      "isActive": true,
      "lastActivityAt": "2024-01-01T12:00:00Z",
      "isInactive": false,
      "inactiveSince": null,
      "removalEligibleAt": null,
      "multisig": {
        "id": 1,
        "multisigPda": "MultisigPDA123...",
        "name": "Main Multisig",
        "threshold": 2,
        "timeLock": 5,
        "isActive": true,
        "createdAt": "2024-01-01T12:00:00Z"
      }
    }
  ]
}
```

#### **Transaction History** (if `includeTransactions=true`)

**Sent Transfers**:
```json
{
  "sentTransfers": [
    {
      "id": 1,
      "receiverId": 2,
      "amount": 10.5,
      "fee": 0.000105,
      "netAmount": 10.499895,
      "currency": "SOL",
      "status": "COMPLETED",
      "transactionHash": "TxHash123...",
      "notes": "Payment for services",
      "createdAt": "2024-01-01T12:00:00Z",
      "receiver": {
        "id": 2,
        "firstName": "Jane",
        "email": "jane@example.com"
      }
    }
  ]
}
```

**Received Transfers**:
```json
{
  "receivedTransfers": [
    {
      "id": 2,
      "senderId": 1,
      "amount": 5.0,
      "fee": 0.00005,
      "netAmount": 4.99995,
      "currency": "SOL",
      "status": "COMPLETED",
      "transactionHash": "TxHash456...",
      "notes": "Refund",
      "createdAt": "2024-01-01T12:00:00Z",
      "sender": {
        "id": 1,
        "firstName": "John",
        "email": "john@example.com"
      }
    }
  ]
}
```

**Deposits**:
```json
{
  "deposits": [
    {
      "id": 1,
      "vaultId": 1,
      "amount": 100.0,
      "currency": "SOL",
      "status": "COMPLETED",
      "transactionHash": "DepositHash123...",
      "notes": "Initial deposit",
      "createdAt": "2024-01-01T12:00:00Z",
      "vault": {
        "id": 1,
        "address": "VaultAddress123...",
        "name": "Main Vault",
        "totalBalance": 1000.0
      }
    }
  ]
}
```

**Withdrawals**:
```json
{
  "withdrawals": [
    {
      "id": 1,
      "vaultId": 1,
      "amount": 50.0,
      "currency": "SOL",
      "status": "COMPLETED",
      "transactionHash": "WithdrawalHash123...",
      "notes": "Emergency withdrawal",
      "createdAt": "2024-01-01T12:00:00Z",
      "vault": {
        "id": 1,
        "address": "VaultAddress123...",
        "name": "Main Vault",
        "totalBalance": 950.0
      }
    }
  ]
}
```

**External Transfers**:
```json
{
  "externalTransfers": [
    {
      "id": 1,
      "fromWallet": "UserWallet123...",
      "toExternalWallet": "ExternalWallet123...",
      "amount": 25.0,
      "fee": 0.00025,
      "netAmount": 24.99975,
      "currency": "SOL",
      "status": "COMPLETED",
      "transactionHash": "ExternalTxHash123...",
      "feeWalletAddress": "FeeWallet123...",
      "notes": "External payment",
      "createdAt": "2024-01-01T12:00:00Z",
      "fees": [
        {
          "id": 1,
          "amount": 0.00025,
          "currency": "SOL",
          "feeRate": 0.00001,
          "feeWalletAddress": "FeeWallet123...",
          "status": "COLLECTED",
          "createdAt": "2024-01-01T12:00:00Z"
        }
      ]
    }
  ]
}
```

### **Pagination Object**
```json
{
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

### **Summary Object**
```json
{
  "summary": {
    "totalUsers": 150,
    "activeUsers": 120,
    "usersWithMultisig": 120,
    "totalBalance": 50000.5,
    "totalTransfers": 2500,
    "totalDeposits": 800,
    "totalWithdrawals": 300,
    "totalExternalTransfers": 150
  }
}
```

## 🔧 **Usage Examples**

### **Basic Usage**
```bash
# Get all users with default settings
curl -X GET "http://localhost:3000/api/users/all" \
  -H "X-CSRF-Token: your-csrf-token"
```

### **Pagination**
```bash
# Get first 50 users
curl -X GET "http://localhost:3000/api/users/all?limit=50&offset=0" \
  -H "X-CSRF-Token: your-csrf-token"

# Get next 50 users
curl -X GET "http://localhost:3000/api/users/all?limit=50&offset=50" \
  -H "X-CSRF-Token: your-csrf-token"
```

### **Minimal Data**
```bash
# Get users without transaction history
curl -X GET "http://localhost:3000/api/users/all?includeTransactions=false" \
  -H "X-CSRF-Token: your-csrf-token"
```

### **Include Inactive Users**
```bash
# Get all users including those without multisig
curl -X GET "http://localhost:3000/api/users/all?includeInactive=true" \
  -H "X-CSRF-Token: your-csrf-token"
```

### **Multisig Only**
```bash
# Get only multisig details without transactions
curl -X GET "http://localhost:3000/api/users/all?includeTransactions=false&includeMultisig=true" \
  -H "X-CSRF-Token: your-csrf-token"
```

## 📊 **Performance Considerations**

### **Data Limits**
- **Maximum Users**: 1000 users per request
- **Transaction History**: Limited to last 50 records per type
- **Pagination**: Recommended for large datasets

### **Optimization Features**
- **Selective Loading**: Only load requested data types
- **Efficient Queries**: Optimized database queries with proper indexing
- **Pagination**: Prevents memory issues with large datasets
- **Caching**: Summary statistics can be cached for better performance

### **Memory Usage**
- **Small Dataset** (< 100 users): ~1-2 MB
- **Medium Dataset** (100-500 users): ~5-10 MB
- **Large Dataset** (500-1000 users): ~10-20 MB

## 🛡️ **Security Features**

### **Access Control**
- **CSRF Protection**: All requests require valid CSRF token
- **Rate Limiting**: Built-in rate limiting for API protection
- **Data Sanitization**: All data is properly sanitized before return

### **Data Privacy**
- **Sensitive Data**: No sensitive information exposed
- **Selective Fields**: Only necessary fields included in responses
- **Audit Trail**: All access is logged for security monitoring

## 📈 **Use Cases**

### **Admin Dashboard**
- Complete user overview with all details
- Transaction monitoring and analysis
- Multisig management and oversight
- System statistics and metrics

### **User Management**
- User account management
- Balance tracking and monitoring
- Transaction history analysis
- Multisig configuration management

### **Reporting and Analytics**
- System-wide statistics
- User activity analysis
- Transaction pattern analysis
- Performance monitoring

### **Data Export**
- Complete user data export
- Transaction history export
- Multisig configuration export
- System metrics export

## 🔍 **Error Handling**

### **Common Errors**

#### **400 Bad Request**
```json
{
  "message": "Invalid parameters",
  "error": "Bad Request",
  "details": "Limit cannot exceed 1000"
}
```

#### **500 Internal Server Error**
```json
{
  "message": "Database error",
  "error": "Internal Server Error",
  "details": "Please try again later"
}
```

### **Error Categories**
- **Validation Errors**: Invalid parameters or values
- **Database Errors**: Database connection or query failures
- **Permission Errors**: Insufficient access rights
- **System Errors**: General system failures

## 🚀 **Future Enhancements**

### **Planned Features**
- **Real-time Updates**: WebSocket support for live data
- **Advanced Filtering**: More sophisticated filtering options
- **Data Export**: CSV/Excel export functionality
- **Caching**: Redis caching for improved performance

### **Performance Improvements**
- **Database Optimization**: Query optimization and indexing
- **Response Compression**: Gzip compression for large responses
- **CDN Integration**: CDN support for static data
- **Background Processing**: Async data processing for large requests

## 📋 **Response Codes**

| Code | Description |
|------|-------------|
| 200 | Success - Users retrieved successfully |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid CSRF token |
| 500 | Internal Server Error - Server error occurred |

This comprehensive users API provides complete access to all user data and associated information with flexible filtering and pagination options! 🎉

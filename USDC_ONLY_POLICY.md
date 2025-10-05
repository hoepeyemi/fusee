# USDC-Only Policy for Wallet Transfers

This document describes the implementation of the USDC-only policy for wallet transfers between addresses in the app.

## 🎯 **Overview**

The system now enforces that **only USDC (USD Coin) on Solana** can be transferred between wallet addresses in the app. This policy applies to:

- **Wallet-to-Wallet Transfers**: Direct transfers between user wallet addresses
- **Multisig Proposals**: All wallet transfer proposals must use USDC
- **Real Fee Transactions**: Fee collection is done in USDC
- **All Transfer Types**: Internal transfers, external transfers, and wallet transfers

## 🔧 **Implementation Details**

### **Updated Services**

#### **WalletTransferService**
- **Default Currency**: Changed from `SOL` to `USDC`
- **Validation**: Added strict USDC-only validation
- **Error Messages**: Updated to reflect USDC-only policy
- **Amount Limits**: Updated to reflect USDC amounts

#### **MultisigProposalService**
- **Currency Validation**: Added USDC-only validation for wallet transfer proposals
- **Error Handling**: Clear error messages for non-USDC currencies
- **Proposal Creation**: Only accepts USDC for wallet transfers

#### **API Routes**
- **Default Parameters**: Changed default currency from `SOL` to `USDC`
- **Validation**: Added currency validation in route handlers
- **Error Responses**: Clear error messages for invalid currencies
- **Documentation**: Updated Swagger documentation

### **Code Changes**

#### **WalletTransferService Updates**

```typescript
// Default currency changed to USDC
public static async createWalletTransferProposal(
  fromWallet: string,
  toWallet: string,
  amount: number,
  currency: string = 'USDC', // Changed from 'SOL'
  notes?: string
): Promise<{...}> {
  // Validation for USDC only
  if (!currency || currency !== 'USDC') {
    throw new Error('Only USDC transfers are allowed between wallet addresses');
  }
  
  // Amount limit updated for USDC
  if (amount > 1000000) {
    throw new Error('Amount cannot exceed 1,000,000 USDC');
  }
}
```

#### **Route Handler Updates**

```typescript
// Default currency changed to USDC
const { fromWallet, toWallet, amount, currency = 'USDC', notes } = req.body;

// Currency validation added
if (currency !== 'USDC') {
  return res.status(400).json({
    message: 'Invalid currency',
    error: 'Bad Request',
    details: 'Only USDC transfers are allowed between wallet addresses'
  });
}
```

#### **MultisigProposalService Updates**

```typescript
// Currency validation for wallet transfers
if (request.currency !== 'USDC') {
  throw new Error('Only USDC transfers are allowed between wallet addresses');
}
```

## 📊 **API Changes**

### **Updated Endpoints**

#### **POST /api/wallet-transfers**
- **Default Currency**: `USDC` (was `SOL`)
- **Validation**: Only accepts `USDC`
- **Error Response**: Clear message for non-USDC currencies

#### **POST /api/wallet-transfers/real-fees**
- **Default Currency**: `USDC` (was `SOL`)
- **Validation**: Only accepts `USDC`
- **Amount Limits**: Updated to reflect USDC amounts

### **Updated Swagger Documentation**

```yaml
currency:
  type: string
  description: Currency type - only USDC allowed for wallet transfers
  example: "USDC"
```

### **Error Responses**

#### **Invalid Currency Error**
```json
{
  "message": "Invalid currency",
  "error": "Bad Request",
  "details": "Only USDC transfers are allowed between wallet addresses"
}
```

#### **Amount Limit Error**
```json
{
  "message": "Amount cannot exceed 1,000,000 USDC",
  "error": "Bad Request"
}
```

## 🚀 **Usage Examples**

### **Valid USDC Transfer**
```bash
curl -X POST "http://localhost:3000/api/wallet-transfers" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "fromWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "toWallet": "FeeWallet1234567890123456789012345678901234567890",
    "amount": 100.0,
    "currency": "USDC",
    "notes": "USDC transfer"
  }'
```

### **Invalid Currency (Will Fail)**
```bash
curl -X POST "http://localhost:3000/api/wallet-transfers" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "fromWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "toWallet": "FeeWallet1234567890123456789012345678901234567890",
    "amount": 100.0,
    "currency": "SOL",
    "notes": "SOL transfer - will fail"
  }'
```

**Response:**
```json
{
  "message": "Invalid currency",
  "error": "Bad Request",
  "details": "Only USDC transfers are allowed between wallet addresses"
}
```

## 🛡️ **Validation Rules**

### **Currency Validation**
- **Allowed**: Only `USDC`
- **Rejected**: `SOL`, `USDT`, or any other currency
- **Default**: `USDC` if not specified
- **Error**: Clear error message for invalid currencies

### **Amount Validation**
- **Minimum**: Greater than 0
- **Maximum**: 1,000,000 USDC
- **Type**: Must be a number
- **Precision**: Supports decimal amounts

### **Wallet Validation**
- **Format**: Valid Solana wallet addresses
- **Required**: Both from and to wallets must be provided
- **Uniqueness**: From and to wallets must be different

## 📈 **Benefits**

### **Consistency**
- **Single Currency**: All wallet transfers use the same currency
- **Simplified Logic**: Reduces complexity in transfer processing
- **Clear Expectations**: Users know exactly what currency to use

### **Stability**
- **Price Stability**: USDC is pegged to USD, providing price stability
- **Reduced Volatility**: Avoids SOL price fluctuations
- **Predictable Fees**: Fees are calculated in stable currency

### **Compliance**
- **Regulatory Clarity**: USDC is widely accepted and regulated
- **Audit Trail**: Clear currency tracking for compliance
- **Reporting**: Simplified reporting with single currency

## 🔍 **Technical Details**

### **Database Schema**
- **Currency Field**: Defaults to `USDC` for wallet transfers
- **Amount Storage**: Supports decimal precision for USDC amounts
- **Fee Calculation**: Fees calculated in USDC

### **Blockchain Integration**
- **USDC Token**: Uses USDC token on Solana blockchain
- **Token Program**: Integrates with Solana Token Program
- **Transfer Instructions**: Uses USDC-specific transfer instructions

### **Fee Structure**
- **Fee Rate**: 0.001% (0.00001) of transfer amount
- **Minimum Fee**: 0 USDC (no minimum fee)
- **Maximum Fee**: 10 USDC (0.001% of 1,000,000 USDC)
- **Fee Currency**: Collected in USDC

## 🚨 **Migration Notes**

### **Breaking Changes**
- **Default Currency**: Changed from `SOL` to `USDC`
- **Validation**: Added strict currency validation
- **Error Messages**: Updated to reflect USDC-only policy

### **Backward Compatibility**
- **API Endpoints**: Same endpoints, different validation
- **Request Format**: Same request format
- **Response Format**: Same response format (with updated messages)

### **Client Updates Required**
- **Currency Parameter**: Must specify `USDC` or omit (defaults to `USDC`)
- **Error Handling**: Handle new currency validation errors
- **UI Updates**: Update UI to reflect USDC-only policy

## 📋 **Testing**

### **Valid Test Cases**
```javascript
// Valid USDC transfer
{
  "fromWallet": "valid_wallet_address",
  "toWallet": "valid_wallet_address",
  "amount": 100.0,
  "currency": "USDC"
}

// Valid USDC transfer with default currency
{
  "fromWallet": "valid_wallet_address",
  "toWallet": "valid_wallet_address",
  "amount": 100.0
  // currency defaults to USDC
}
```

### **Invalid Test Cases**
```javascript
// Invalid SOL transfer
{
  "fromWallet": "valid_wallet_address",
  "toWallet": "valid_wallet_address",
  "amount": 100.0,
  "currency": "SOL" // Will fail
}

// Invalid USDT transfer
{
  "fromWallet": "valid_wallet_address",
  "toWallet": "valid_wallet_address",
  "amount": 100.0,
  "currency": "USDT" // Will fail
}
```

## 🔧 **Configuration**

### **Environment Variables**
No new environment variables required. The policy is enforced through code validation.

### **Database Updates**
No database schema changes required. The existing `currency` field supports the USDC-only policy.

### **Service Configuration**
- **Fee Rate**: 0.001% (configurable in `WalletTransferService.FEE_RATE`)
- **Amount Limits**: 1,000,000 USDC maximum (configurable in validation)
- **Currency Validation**: Enforced in all transfer services

## 🚀 **Future Considerations**

### **Potential Enhancements**
- **Multi-Currency Support**: Could be extended to support other stablecoins
- **Dynamic Currency**: Could support different currencies for different transfer types
- **Currency Conversion**: Could add automatic currency conversion features

### **Monitoring**
- **Transfer Volume**: Monitor USDC transfer volumes
- **Error Rates**: Track currency validation error rates
- **User Adoption**: Monitor user adoption of USDC-only policy

This USDC-only policy provides a stable, consistent, and compliant foundation for wallet transfers in the app! 🎉


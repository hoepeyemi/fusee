# Error Handling System

This document describes the comprehensive error handling system implemented across all transfer services and API routes to provide users with clear, actionable error messages.

## 🎯 **Overview**

The error handling system provides:

- **User-Friendly Messages**: Clear, actionable error messages for frontend display
- **Categorized Errors**: Different error types with appropriate HTTP status codes
- **Detailed Logging**: Server-side logging for debugging and monitoring
- **Graceful Degradation**: Fallback error messages when specific handling isn't available
- **Validation Feedback**: Specific validation error messages for form inputs

## 🏗️ **Error Categories**

### **1. Validation Errors (400 Bad Request)**
**Purpose**: Input validation failures
**Examples**:
- Invalid wallet addresses
- Invalid amounts (negative, zero, too large)
- Invalid currency types
- Missing required fields

**Response Format**:
```json
{
  "message": "Validation failed",
  "error": "Bad Request",
  "details": "Amount must be greater than 0"
}
```

### **2. Authentication/Authorization Errors (401/403)**
**Purpose**: User authentication and permission issues
**Examples**:
- Invalid user ID
- User not found
- Insufficient permissions

**Response Format**:
```json
{
  "message": "User not found",
  "error": "Not Found",
  "details": "Please check your user ID"
}
```

### **3. Service Unavailable Errors (503)**
**Purpose**: External service dependencies
**Examples**:
- Multisig service unavailable
- Multisig not configured
- External API failures

**Response Format**:
```json
{
  "message": "Multisig service unavailable",
  "error": "Service Unavailable",
  "details": "Please try again later"
}
```

### **4. Database Errors (500)**
**Purpose**: Database operation failures
**Examples**:
- Connection issues
- Query failures
- Transaction rollbacks

**Response Format**:
```json
{
  "message": "Database error",
  "error": "Internal Server Error",
  "details": "Please try again later"
}
```

### **5. Transaction Errors (500)**
**Purpose**: Blockchain transaction failures
**Examples**:
- Fee transaction failures
- Insufficient funds
- Network issues

**Response Format**:
```json
{
  "message": "Failed to send fee to treasury",
  "error": "Fee Transaction Failed",
  "details": "Insufficient funds for transaction fee"
}
```

## 🔧 **Implementation Details**

### **Service Layer Error Handling**

#### **WalletTransferService**
```typescript
try {
  // Validate inputs
  if (!fromWallet || typeof fromWallet !== 'string') {
    throw new Error('Invalid sender wallet address');
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // ... business logic

} catch (error) {
  console.error('Error creating wallet transfer proposal:', error);
  
  if (error instanceof Error) {
    if (error.message.includes('multisig') || error.message.includes('Multisig')) {
      throw new Error('Multisig service error: ' + error.message);
    }
    
    if (error.message.includes('Prisma') || error.message.includes('database')) {
      throw new Error('Database error: ' + error.message);
    }
    
    if (error.message.includes('validation') || error.message.includes('Invalid')) {
      throw new Error('Validation error: ' + error.message);
    }
    
    // Return the original error message for user-friendly errors
    throw new Error(error.message);
  }
  
  // Generic error fallback
  throw new Error('Failed to create wallet transfer proposal. Please try again.');
}
```

#### **ExternalTransferService**
```typescript
try {
  // Validate inputs
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    throw new Error('Invalid user ID');
  }

  if (!fromWallet || typeof fromWallet !== 'string') {
    throw new Error('Invalid sender wallet address');
  }

  // ... business logic

} catch (error) {
  console.error('Error creating external transfer proposal:', error);
  
  if (error instanceof Error) {
    if (error.message.includes('User not found')) {
      throw new Error('User not found. Please check your user ID.');
    }
    
    // ... other error handling
  }
  
  throw new Error('Failed to create external transfer proposal. Please try again.');
}
```

#### **MultisigProposalService**
```typescript
try {
  // Validate request
  if (!request.fromWallet || !request.toWallet) {
    throw new Error('Invalid wallet addresses');
  }

  if (!request.amount || request.amount <= 0) {
    throw new Error('Invalid amount');
  }

  // ... business logic

} catch (error) {
  console.error('Error creating wallet transfer proposal:', error);
  
  if (error instanceof Error) {
    if (error.message.includes('multisig') || error.message.includes('Multisig')) {
      throw new Error('Multisig service error: ' + error.message);
    }
    
    // ... other error handling
  }
  
  throw new Error('Failed to create wallet transfer proposal. Please try again.');
}
```

### **API Route Error Handling**

#### **Wallet Transfers Route**
```typescript
router.post('/real-fees', async (req: Request, res: Response) => {
  try {
    // ... validation and business logic

  } catch (error) {
    console.error('Error processing wallet transfer with real fees:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Validation error:')) {
        return res.status(400).json({
          message: 'Validation failed',
          error: 'Bad Request',
          details: error.message.replace('Validation error: ', '')
        });
      }
      
      if (error.message.includes('Multisig service error:')) {
        return res.status(503).json({
          message: 'Multisig service unavailable',
          error: 'Service Unavailable',
          details: error.message.replace('Multisig service error: ', '')
        });
      }
      
      if (error.message.includes('Database error:')) {
        return res.status(500).json({
          message: 'Database error',
          error: 'Internal Server Error',
          details: 'Please try again later'
        });
      }
      
      if (error.message.includes('No main multisig found')) {
        return res.status(503).json({
          message: 'Multisig not configured',
          error: 'Service Unavailable',
          details: 'Please contact administrator to set up multisig'
        });
      }
    }
    
    res.status(500).json({
      message: 'Failed to process wallet transfer',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});
```

#### **External Transfers Route**
```typescript
router.post('/real-fees', async (req: Request, res: Response) => {
  try {
    // ... validation and business logic

  } catch (error) {
    console.error('Error processing external transfer with real fees:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        return res.status(404).json({
          message: 'User not found',
          error: 'Not Found',
          details: 'Please check your user ID'
        });
      }
      
      // ... other error handling
    }
    
    res.status(500).json({
      message: 'Failed to process external transfer',
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});
```

## 📊 **Error Response Examples**

### **Validation Errors**
```json
// Invalid amount
{
  "message": "Validation failed",
  "error": "Bad Request",
  "details": "Amount must be greater than 0"
}

// Invalid currency
{
  "message": "Validation failed",
  "error": "Bad Request",
  "details": "Currency must be SOL, USDC, or USDT"
}

// Missing fields
{
  "message": "Missing required fields",
  "error": "Bad Request",
  "required": ["fromWallet", "toWallet", "amount"]
}
```

### **Service Errors**
```json
// Multisig not configured
{
  "message": "Multisig not configured",
  "error": "Service Unavailable",
  "details": "Please contact administrator to set up multisig"
}

// Multisig service error
{
  "message": "Multisig service unavailable",
  "error": "Service Unavailable",
  "details": "Connection timeout"
}
```

### **User Errors**
```json
// User not found
{
  "message": "User not found",
  "error": "Not Found",
  "details": "Please check your user ID"
}

// Invalid user ID
{
  "message": "Validation failed",
  "error": "Bad Request",
  "details": "Invalid user ID"
}
```

### **Transaction Errors**
```json
// Fee transaction failed
{
  "message": "Failed to send fee to treasury",
  "error": "Fee Transaction Failed",
  "details": "Insufficient funds for transaction fee"
}

// Database error
{
  "message": "Database error",
  "error": "Internal Server Error",
  "details": "Please try again later"
}
```

## 🛡️ **Error Handling Best Practices**

### **1. Input Validation**
- **Validate Early**: Check inputs at the service layer
- **Clear Messages**: Provide specific validation error messages
- **Type Checking**: Ensure proper data types
- **Range Validation**: Check amount limits and constraints

### **2. Error Categorization**
- **Group Similar Errors**: Use consistent error categories
- **Appropriate Status Codes**: Use correct HTTP status codes
- **User-Friendly Messages**: Avoid technical jargon in user-facing messages
- **Detailed Logging**: Log technical details for debugging

### **3. Graceful Degradation**
- **Fallback Messages**: Provide generic error messages when specific handling isn't available
- **Service Recovery**: Handle temporary service unavailability
- **User Guidance**: Provide actionable next steps for users

### **4. Security Considerations**
- **No Sensitive Data**: Don't expose internal system details
- **Generic Messages**: Use generic messages for security-related errors
- **Logging**: Log security-related errors for monitoring

## 🔍 **Error Monitoring**

### **Server-Side Logging**
```typescript
console.error('Error creating wallet transfer proposal:', error);
```

### **Error Tracking**
- **Categorize Errors**: Group errors by type and frequency
- **Monitor Trends**: Track error patterns over time
- **Alert on Critical Errors**: Set up alerts for critical failures
- **Performance Impact**: Monitor error impact on system performance

### **User Experience**
- **Clear Messages**: Provide clear, actionable error messages
- **Next Steps**: Guide users on how to resolve errors
- **Retry Logic**: Implement retry mechanisms where appropriate
- **Fallback Options**: Provide alternative actions when possible

## 📈 **Benefits**

### **For Users**
- **Clear Feedback**: Understand what went wrong
- **Actionable Guidance**: Know how to fix issues
- **Better Experience**: Reduced frustration and confusion
- **Trust Building**: Professional error handling builds confidence

### **For Developers**
- **Easier Debugging**: Detailed server-side logging
- **Better Monitoring**: Categorized error tracking
- **Faster Resolution**: Clear error patterns and causes
- **Improved Reliability**: Proactive error handling

### **For Operations**
- **Better Monitoring**: Track system health and errors
- **Faster Response**: Quick identification of issues
- **Improved Uptime**: Proactive error handling and recovery
- **User Satisfaction**: Better user experience during errors

## 🚀 **Future Enhancements**

### **Planned Improvements**
- **Error Analytics**: Detailed error reporting and analytics
- **User Notifications**: Real-time error notifications
- **Retry Mechanisms**: Automatic retry for transient errors
- **Error Recovery**: Automatic recovery from certain error conditions

### **Monitoring Integration**
- **Error Tracking**: Integration with error tracking services
- **Performance Monitoring**: Track error impact on performance
- **Alerting**: Real-time alerts for critical errors
- **Dashboards**: Visual error monitoring and reporting

This comprehensive error handling system ensures users receive clear, actionable feedback while providing developers with detailed information for debugging and monitoring! 🎉

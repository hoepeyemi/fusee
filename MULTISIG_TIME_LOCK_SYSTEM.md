# Multisig Time Lock System

This document describes the comprehensive time lock implementation for the multisig governance system, providing security through delayed execution of approved proposals.

## 🎯 **Overview**

The Time Lock System provides an additional security layer for multisig operations by enforcing a mandatory waiting period between proposal approval and execution. This prevents immediate execution of potentially malicious or erroneous proposals.

## 🔧 **Implementation Details**

### **Core Components**

#### **Time Lock Enforcement**
- **Automatic Validation**: All proposal executions are automatically validated against time lock rules
- **Configurable Duration**: Time lock duration is configurable per multisig (0 = no time lock)
- **Approval-Based Timing**: Time lock starts from the latest approval timestamp
- **Real-Time Status**: Real-time time lock status checking

#### **Time Lock Calculation**
```typescript
private canExecuteProposal(proposal: any): { canExecute: boolean; reason?: string; timeRemaining?: number } {
  if (!proposal.multisig.timeLock || proposal.multisig.timeLock === 0) {
    return { canExecute: true };
  }

  // Find the latest approval timestamp
  const latestApproval = proposal.approvals.reduce((latest: any, approval: any) => {
    return approval.createdAt > latest.createdAt ? approval : latest;
  }, proposal.approvals[0]);

  if (!latestApproval) {
    return { canExecute: false, reason: 'No approvals found' };
  }

  const approvalTime = new Date(latestApproval.createdAt).getTime();
  const currentTime = Date.now();
  const timeElapsed = Math.floor((currentTime - approvalTime) / 1000); // Convert to seconds
  const timeRemaining = proposal.multisig.timeLock - timeElapsed;

  if (timeRemaining > 0) {
    return {
      canExecute: false,
      reason: `Time lock not expired. ${timeRemaining} seconds remaining`,
      timeRemaining
    };
  }

  return { canExecute: true };
}
```

### **API Endpoints**

#### **Get Time Lock Status**
```http
GET /api/multisig-proposals/{proposalId}/time-lock-status
```

**Response:**
```json
{
  "message": "Time lock status retrieved successfully",
  "canExecute": false,
  "timeLock": 3600,
  "timeRemaining": 1800,
  "reason": "Time lock not expired. 1800 seconds remaining",
  "latestApprovalTime": "2024-01-01T12:00:00.000Z"
}
```

#### **Get Proposal Status (Enhanced)**
```http
GET /api/multisig-proposals/{proposalId}/status
```

**Response:**
```json
{
  "id": 1,
  "status": "APPROVED",
  "fromWallet": "wallet1",
  "toWallet": "wallet2",
  "amount": 100,
  "currency": "USDC",
  "memo": "Transfer",
  "transactionHash": null,
  "approvals": 2,
  "threshold": 2,
  "timeLock": 3600,
  "canExecute": false,
  "timeRemaining": 1800,
  "timeLockReason": "Time lock not expired. 1800 seconds remaining",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

#### **Execute Proposal (With Time Lock Validation)**
```http
POST /api/multisig-proposals/{proposalId}/execute
```

**Request Body:**
```json
{
  "executorPublicKey": "executor_wallet_address"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Proposal executed successfully",
  "transactionHash": "EXEC_1234567890_abcdef12"
}
```

**Time Lock Error Response:**
```json
{
  "message": "Cannot execute proposal",
  "error": "Time Lock Active",
  "details": "Time lock not expired. 1800 seconds remaining"
}
```

## 🛡️ **Security Features**

### **Time Lock Enforcement**
- **Mandatory Validation**: All executions are validated against time lock rules
- **No Bypass**: Time lock cannot be bypassed or overridden
- **Approval-Based**: Time lock starts from the latest approval, not proposal creation
- **Real-Time Calculation**: Time remaining is calculated in real-time

### **Error Handling**
- **Clear Error Messages**: Specific error messages for time lock violations
- **Status Codes**: Appropriate HTTP status codes (400 for time lock violations)
- **Detailed Information**: Time remaining and reason for failure

### **Configuration**
- **Per-Multisig**: Each multisig can have its own time lock duration
- **Zero Time Lock**: Setting time lock to 0 disables the feature
- **Environment Default**: Default time lock can be set via environment variables

## 📊 **Time Lock Workflow**

### **Proposal Lifecycle with Time Lock**

1. **Proposal Creation**
   - Proposal is created with status `PENDING`
   - Time lock is not yet active

2. **Proposal Approval**
   - Members approve the proposal
   - Time lock starts from the latest approval timestamp
   - Status remains `APPROVED` but execution is blocked

3. **Time Lock Period**
   - Proposal cannot be executed during time lock period
   - Real-time status shows time remaining
   - `canExecute` is `false`

4. **Time Lock Expiry**
   - Time lock expires after configured duration
   - `canExecute` becomes `true`
   - Proposal can now be executed

5. **Execution**
   - Proposal is executed successfully
   - Status changes to `EXECUTED`
   - Transaction hash is recorded

### **Time Lock States**

| State | Description | canExecute | timeRemaining |
|-------|-------------|------------|---------------|
| No Time Lock | timeLock = 0 | true | N/A |
| Time Lock Active | Within time lock period | false | > 0 |
| Time Lock Expired | After time lock period | true | 0 or undefined |

## 🔧 **Configuration**

### **Environment Variables**

```bash
# Default time lock duration in seconds (0 = no time lock)
MULTISIG_DEFAULT_TIME_LOCK=3600  # 1 hour

# Multisig configuration
MULTISIG_DEFAULT_THRESHOLD=2
MULTISIG_MIN_MEMBERS=2
MULTISIG_MAX_MEMBERS=3
```

### **Multisig Creation**

```typescript
// Create multisig with time lock
const multisigService = new MultisigService({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  threshold: 2,
  timeLock: 3600, // 1 hour time lock
  members: [
    { publicKey: 'member1', permissions: ['propose', 'vote', 'execute'] },
    { publicKey: 'member2', permissions: ['propose', 'vote', 'execute'] }
  ]
});
```

## 📈 **Usage Examples**

### **Check Time Lock Status**

```bash
curl -X GET "http://localhost:3000/api/multisig-proposals/1/time-lock-status" \
  -H "X-CSRF-Token: your-csrf-token"
```

**Response:**
```json
{
  "message": "Time lock status retrieved successfully",
  "canExecute": false,
  "timeLock": 3600,
  "timeRemaining": 1800,
  "reason": "Time lock not expired. 1800 seconds remaining",
  "latestApprovalTime": "2024-01-01T12:00:00.000Z"
}
```

### **Get Enhanced Proposal Status**

```bash
curl -X GET "http://localhost:3000/api/multisig-proposals/1/status" \
  -H "X-CSRF-Token: your-csrf-token"
```

**Response:**
```json
{
  "id": 1,
  "status": "APPROVED",
  "timeLock": 3600,
  "canExecute": false,
  "timeRemaining": 1800,
  "timeLockReason": "Time lock not expired. 1800 seconds remaining"
}
```

### **Execute Proposal (Time Lock Active)**

```bash
curl -X POST "http://localhost:3000/api/multisig-proposals/1/execute" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "executorPublicKey": "executor_wallet_address"
  }'
```

**Error Response:**
```json
{
  "message": "Cannot execute proposal",
  "error": "Time Lock Active",
  "details": "Time lock not expired. 1800 seconds remaining"
}
```

### **Execute Proposal (Time Lock Expired)**

```bash
curl -X POST "http://localhost:3000/api/multisig-proposals/1/execute" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token" \
  -d '{
    "executorPublicKey": "executor_wallet_address"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Proposal executed successfully",
  "transactionHash": "EXEC_1234567890_abcdef12"
}
```

## 🚨 **Error Handling**

### **Time Lock Violations**

```json
{
  "message": "Cannot execute proposal",
  "error": "Time Lock Active",
  "details": "Time lock not expired. 1800 seconds remaining"
}
```

### **Invalid Proposal States**

```json
{
  "message": "Cannot execute proposal",
  "error": "Bad Request",
  "details": "Proposal must be approved before execution"
}
```

### **Member Validation**

```json
{
  "message": "Cannot execute proposal",
  "error": "Bad Request",
  "details": "Executor must be a multisig member"
}
```

## 🔍 **Monitoring and Debugging**

### **Time Lock Status Monitoring**

```typescript
// Check time lock status programmatically
const proposalService = MultisigProposalService.getInstance();
const timeLockStatus = await proposalService.getProposalTimeLockStatus(proposalId);

console.log('Time Lock Status:', {
  canExecute: timeLockStatus.canExecute,
  timeLock: timeLockStatus.timeLock,
  timeRemaining: timeLockStatus.timeRemaining,
  reason: timeLockStatus.reason
});
```

### **Real-Time Status Updates**

```typescript
// Poll for time lock status changes
setInterval(async () => {
  const status = await proposalService.getProposalTimeLockStatus(proposalId);
  if (status.canExecute) {
    console.log('Proposal is ready for execution!');
  } else {
    console.log(`Time remaining: ${status.timeRemaining} seconds`);
  }
}, 1000); // Check every second
```

## 🎯 **Benefits**

### **Security**
- **Prevents Immediate Execution**: Malicious proposals cannot be executed immediately
- **Review Period**: Provides time for additional review and validation
- **Audit Trail**: Clear audit trail of approval and execution timing

### **Governance**
- **Deliberate Decision Making**: Forces deliberate decision making process
- **Risk Mitigation**: Reduces risk of hasty or erroneous executions
- **Transparency**: Clear visibility into time lock status

### **Flexibility**
- **Configurable**: Time lock duration can be configured per multisig
- **Optional**: Can be disabled by setting time lock to 0
- **Real-Time**: Real-time status updates and monitoring

## 🚀 **Best Practices**

### **Time Lock Configuration**
- **Balance Security vs. Speed**: Choose appropriate time lock duration
- **Consider Use Case**: Different time locks for different types of operations
- **Regular Review**: Periodically review and adjust time lock settings

### **Monitoring**
- **Real-Time Status**: Monitor time lock status in real-time
- **Alert Systems**: Set up alerts for time lock expiry
- **Dashboard Integration**: Include time lock status in governance dashboards

### **User Experience**
- **Clear Messaging**: Provide clear error messages for time lock violations
- **Status Indicators**: Show time lock status in user interfaces
- **Countdown Timers**: Display countdown timers for time remaining

## 📋 **Future Enhancements**

### **Planned Features**
- **Variable Time Locks**: Different time locks for different proposal types
- **Emergency Override**: Emergency override mechanism for critical situations
- **Time Lock Notifications**: Automated notifications for time lock expiry
- **Historical Analysis**: Time lock usage analytics and reporting

### **Integration Opportunities**
- **Mobile Notifications**: Push notifications for time lock status changes
- **Calendar Integration**: Calendar integration for time lock expiry
- **Slack/Discord Bots**: Bot integration for time lock status updates
- **Email Alerts**: Email notifications for time lock events

The Multisig Time Lock System provides a robust security layer for multisig governance, ensuring that all proposals go through a mandatory review period before execution while maintaining flexibility and real-time monitoring capabilities! 🎉

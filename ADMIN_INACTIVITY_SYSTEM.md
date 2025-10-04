# Admin Inactivity System

This document describes the admin inactivity detection and removal system that automatically removes inactive multisig admins after 48 hours of inactivity.

## 🔧 Overview

The admin inactivity system provides:
- **Activity Tracking**: Monitors when admins last performed actions
- **Inactivity Detection**: Identifies admins who haven't been active for 24+ hours
- **Automatic Removal**: Removes admins who have been inactive for 48+ hours
- **Background Monitoring**: Continuous monitoring with configurable intervals
- **API Management**: RESTful endpoints for managing admin inactivity

## 📊 How It Works

### Activity Tracking
- **Last Activity Timestamp**: Updated whenever an admin performs any multisig operation
- **Automatic Updates**: Activity is tracked for all multisig operations (create, approve, execute)
- **Real-time Monitoring**: Activity status is checked every hour

### Inactivity Detection
- **24-Hour Threshold**: Admins are marked as inactive after 24 hours of no activity
- **48-Hour Removal**: Admins become eligible for removal after 48 hours of inactivity
- **Status Updates**: Admin status is automatically updated based on activity

### Removal Process
- **Eligibility Check**: Only admins inactive for 48+ hours can be removed
- **Safe Removal**: Admins are deactivated (not deleted) to preserve history
- **Audit Trail**: All removal actions are logged with timestamps and reasons

## 🗄️ Database Schema

### MultisigMember Table Updates
```sql
-- New fields added to track admin activity
lastActivityAt DateTime @default(now())     -- Last time member was active
isInactive    Boolean  @default(false)      -- Whether member is considered inactive
inactiveSince DateTime?                     -- When member became inactive
removalEligibleAt DateTime?                 -- When member becomes eligible for removal
```

## 🚀 API Endpoints

### Get Admin Activity Status
```http
GET /api/admin-inactivity/status
```
Returns current activity status of all admins.

**Response:**
```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "memberId": 1,
        "publicKey": "ABC123...",
        "lastActivityAt": "2024-01-15T10:30:00Z",
        "isInactive": false,
        "hoursSinceActivity": 2
      }
    ],
    "total": 3,
    "active": 2,
    "inactive": 1,
    "removalEligible": 0
  }
}
```

### Get Inactivity Statistics
```http
GET /api/admin-inactivity/stats
```
Returns comprehensive inactivity statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAdmins": 5,
    "activeAdmins": 3,
    "inactiveAdmins": 2,
    "removalEligibleAdmins": 1,
    "averageInactivityHours": 12.5
  }
}
```

### Get Removal Eligible Admins
```http
GET /api/admin-inactivity/removal-eligible
```
Returns admins eligible for removal.

**Response:**
```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "memberId": 2,
        "publicKey": "XYZ789...",
        "hoursSinceActivity": 50,
        "isInactive": true
      }
    ],
    "count": 1
  }
}
```

### Update Admin Activity
```http
POST /api/admin-inactivity/update-activity
Content-Type: application/json

{
  "publicKey": "ABC123..."
}
```
Manually update admin activity timestamp.

### Check Inactive Admins
```http
POST /api/admin-inactivity/check-inactive
```
Manually trigger inactive admin check.

### Remove Inactive Admin
```http
DELETE /api/admin-inactivity/remove/:publicKey
Content-Type: application/json

{
  "reason": "Inactive for 48+ hours"
}
```
Remove a specific inactive admin.

### Remove All Eligible Admins
```http
POST /api/admin-inactivity/remove-all-eligible
```
Remove all admins eligible for removal.

## ⚙️ Configuration

### Environment Variables
```bash
# Admin inactivity configuration (in AdminInactivityService)
INACTIVITY_THRESHOLD_HOURS=24    # Hours before considering inactive
REMOVAL_THRESHOLD_HOURS=48       # Hours before eligible for removal
CHECK_INTERVAL_MINUTES=60        # How often to check (minutes)
```

### Service Configuration
```typescript
const adminInactivityService = new AdminInactivityService({
  inactivityThresholdHours: 24,  // Consider inactive after 24 hours
  removalThresholdHours: 48,     // Can be removed after 48 hours
  checkIntervalMinutes: 60       // Check every hour
});
```

## 🔄 Background Monitoring

### Automatic Monitoring
- **Start**: Automatically starts when the server starts
- **Interval**: Checks every hour (configurable)
- **Process**: 
  1. Scans all active admins
  2. Updates inactivity status
  3. Identifies removal-eligible admins
  4. Logs findings

### Manual Monitoring
```typescript
// Run manual check
await adminInactivityService.checkInactiveAdmins();

// Get removal eligible admins
const eligible = await adminInactivityService.getRemovalEligibleAdmins();

// Remove specific admin
await adminInactivityService.removeInactiveAdmin(publicKey, reason);
```

## 📈 Activity Tracking

### Tracked Operations
- **Multisig Creation**: All members involved in creation
- **Transaction Approval**: Members who approve transactions
- **Transaction Execution**: Members who execute transactions
- **Manual Updates**: Via API endpoint

### Activity Update Process
1. **Operation Performed**: Admin performs multisig operation
2. **Activity Update**: `lastActivityAt` timestamp updated
3. **Status Reset**: `isInactive` set to false
4. **Timers Reset**: `inactiveSince` and `removalEligibleAt` cleared

## 🛡️ Security Features

### Safe Removal
- **Deactivation Only**: Admins are deactivated, not deleted
- **History Preservation**: All historical data is maintained
- **Audit Trail**: Complete log of all removal actions

### Validation
- **Eligibility Check**: Only 48+ hour inactive admins can be removed
- **Status Verification**: Ensures admin is actually inactive
- **Permission Checks**: Validates admin exists and is active

### Error Handling
- **Graceful Failures**: Activity tracking failures don't break operations
- **Detailed Logging**: Comprehensive error logging
- **Recovery**: System continues operating even if monitoring fails

## 📊 Monitoring and Alerts

### Console Logging
```
🔄 Starting admin inactivity monitoring (check every 60 minutes)
🔍 Checking for inactive admins...
📊 Found 2 inactive admins
⚠️ 1 admins are eligible for removal
   - ABC123... (inactive for 50h)
🗑️ Removed inactive admin: ABC123... (inactive for 50 hours)
```

### Statistics Tracking
- **Total Admins**: Count of all active admins
- **Active/Inactive**: Breakdown by activity status
- **Removal Eligible**: Count of admins ready for removal
- **Average Inactivity**: Mean hours since last activity

## 🚨 Troubleshooting

### Common Issues

#### No Activity Tracking
- **Check**: Ensure admin inactivity service is imported
- **Verify**: Activity updates are called after operations
- **Debug**: Check console logs for activity update errors

#### Admins Not Being Removed
- **Verify**: Admin has been inactive for 48+ hours
- **Check**: Admin status is marked as inactive
- **Confirm**: Background monitoring is running

#### Database Errors
- **Schema**: Ensure database migration was applied
- **Connection**: Verify database connection is working
- **Permissions**: Check database user permissions

### Debug Commands
```typescript
// Check all admin activity
const activity = await adminInactivityService.getAllAdminActivity();

// Get inactivity statistics
const stats = await adminInactivityService.getInactivityStats();

// Manual inactive check
await adminInactivityService.checkInactiveAdmins();

// Get removal eligible
const eligible = await adminInactivityService.getRemovalEligibleAdmins();
```

## 🔧 Maintenance

### Regular Tasks
- **Monitor Logs**: Check for activity tracking errors
- **Review Statistics**: Monitor inactivity patterns
- **Clean Up**: Remove very old inactive admins if needed

### Configuration Updates
- **Adjust Thresholds**: Modify inactivity/removal thresholds
- **Change Intervals**: Update check frequency
- **Add Notifications**: Implement alert systems

### Database Maintenance
- **Archive Old Data**: Move old inactive admin records
- **Optimize Queries**: Ensure efficient activity queries
- **Backup**: Regular backups of admin activity data

## 📝 Best Practices

### Configuration
- **Reasonable Thresholds**: 24h inactive, 48h removal
- **Regular Monitoring**: Check logs and statistics
- **Test Changes**: Verify configuration changes work

### Operations
- **Monitor Activity**: Watch for unusual inactivity patterns
- **Manual Reviews**: Periodically review removal-eligible admins
- **Document Changes**: Log any manual admin removals

### Security
- **Audit Trail**: Keep records of all admin removals
- **Access Control**: Limit who can remove admins
- **Notifications**: Alert when admins are removed

This system ensures that inactive admins don't become security risks while maintaining a complete audit trail of all administrative actions.


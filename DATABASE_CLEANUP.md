# Database Cleanup Scripts

## 🗄️ Overview

This project includes comprehensive database cleanup scripts to delete all data or drop all tables from the PostgreSQL database. These scripts are useful for:

- **Development**: Resetting the database during development
- **Testing**: Cleaning up test data
- **Maintenance**: Performing database maintenance
- **Migration**: Preparing for schema changes

## ⚠️ WARNING

**These scripts will permanently delete ALL data in the database!**
**This action cannot be undone!**

Always backup your database before running these scripts.

## 📁 Available Scripts

### 1. Node.js Script (`scripts/delete-all-tables.js`)
**Most comprehensive and recommended**

#### Features:
- ✅ Interactive confirmation prompts
- ✅ Dry run mode to preview changes
- ✅ Two cleanup methods: delete records vs drop tables
- ✅ Proper foreign key constraint handling
- ✅ Detailed progress reporting
- ✅ Error handling and recovery
- ✅ Summary statistics

#### Usage:
```bash
# Interactive mode (recommended)
yarn db:clean

# Skip confirmation prompts
yarn db:clean:confirm

# Dry run (preview changes without deleting)
yarn db:clean:dry

# Drop all tables (nuclear option)
yarn db:clean:drop

# Test database connection and show current data
yarn db:clean:test
```

### 2. PowerShell Script (`scripts/delete-all-tables.ps1`)
**Windows PowerShell version**

```powershell
# Interactive mode
.\scripts\delete-all-tables.ps1

# Skip confirmation
.\scripts\delete-all-tables.ps1 -Confirm

# Dry run
.\scripts\delete-all-tables.ps1 -DryRun

# Drop all tables
.\scripts\delete-all-tables.ps1 -DropTables
```

### 3. SQL Script (`scripts/delete-all-tables.sql`)
**Raw SQL for direct database execution**

```bash
# Using psql
psql -d your_database -f scripts/delete-all-tables.sql

# Using Prisma
npx prisma db execute --file scripts/delete-all-tables.sql
```

## 📊 Current Database Status

Based on the test run, your database currently contains:

| Table | Records |
|-------|---------|
| multisig_approvals | 0 |
| multisig_proposals | 0 |
| multisig_transactions | 0 |
| multisig_members | 0 |
| multisigs | 0 |
| external_fees | 0 |
| external_transfers | 0 |
| wallet_fees | 5 |
| wallet_transfers | 6 |
| fees | 10 |
| withdrawals | 0 |
| deposits | 6 |
| transfers | 10 |
| wallets | 8 |
| vaults | 1 |
| users | 8 |

**Total: 54 records across 16 tables**

## 🚀 Quick Start

### 1. Test the Scripts First
```bash
# Test database connection and show current data
yarn db:clean:test
```

### 2. Preview What Would Be Deleted
```bash
# Dry run - see what would be deleted without actually deleting
yarn db:clean:dry
```

### 3. Clean the Database
```bash
# Interactive cleanup (recommended)
yarn db:clean

# Or skip prompts
yarn db:clean:confirm
```

## 🔧 Cleanup Methods

### Method 1: Delete Records (Recommended)
- ✅ Deletes all records from tables
- ✅ Preserves table structure
- ✅ Can be undone by restoring from backup
- ✅ Safer option
- ✅ No need to run migrations afterward

### Method 2: Drop Tables (Nuclear Option)
- ⚠️ Completely removes tables from database
- ⚠️ Requires running migrations to recreate tables
- ⚠️ Cannot be undone without backup
- ✅ More thorough cleanup

## 📋 Tables Processed

The scripts process tables in the correct order (respecting foreign key constraints):

1. `multisig_approvals` (0 records)
2. `multisig_proposals` (0 records)
3. `multisig_transactions` (0 records)
4. `multisig_members` (0 records)
5. `multisigs` (0 records)
6. `external_fees` (0 records)
7. `external_transfers` (0 records)
8. `wallet_fees` (5 records)
9. `wallet_transfers` (6 records)
10. `fees` (10 records)
11. `transfers` (10 records)
12. `withdrawals` (0 records)
13. `deposits` (6 records)
14. `vaults` (1 records)
15. `wallets` (8 records)
16. `users` (8 records)

## 🛡️ Safety Features

- **Confirmation Prompts**: All scripts ask for confirmation before proceeding
- **Dry Run Mode**: Preview what would be deleted without making changes
- **Foreign Key Handling**: Properly disables/enables constraints during cleanup
- **Error Recovery**: Continues processing even if some tables fail
- **Progress Reporting**: Shows detailed progress and results
- **Summary Statistics**: Reports how many records/tables were affected

## 🔄 After Cleanup

### If You Used "Delete Records" Method:
- Tables remain intact
- All data is removed
- No additional steps needed

### If You Used "Drop Tables" Method:
- Tables are completely removed
- You need to recreate the schema:

```bash
# Push the schema to recreate all tables
yarn db:push

# Or run migrations if you have them
yarn db:migrate
```

## 💾 Backup Recommendation

Before running any cleanup script, create a backup:

```bash
# Using pg_dump
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Using Prisma
npx prisma db pull
```

## 🐛 Troubleshooting

### Permission Errors
Ensure your database user has the necessary privileges:
- `DELETE` on all tables
- `DROP` on all tables (if using drop method)
- `ALTER` on database (for constraint management)

### Foreign Key Errors
The scripts handle foreign key constraints automatically, but if you encounter issues:
1. Try the SQL script method
2. Check that all tables exist
3. Verify your database connection

### Connection Errors
Ensure your `DATABASE_URL` environment variable is set correctly in your `.env` file.

## 📝 Examples

### Development Reset
```bash
# Quick reset during development
yarn db:clean:confirm
```

### Production Maintenance
```bash
# Safe cleanup with confirmation
yarn db:clean
# Follow the prompts carefully
```

### Testing
```bash
# Preview changes first
yarn db:clean:dry

# Then clean if satisfied
yarn db:clean:confirm
```

## 🎯 Best Practices

1. **Always test first**: Run `yarn db:clean:test` to verify connection
2. **Use dry run**: Run `yarn db:clean:dry` to preview changes
3. **Create backups**: Always backup before cleanup
4. **Use interactive mode**: Let the script guide you through the process
5. **Verify results**: Check the summary after cleanup

## 📞 Support

If you encounter issues with the cleanup scripts:

1. Check the error messages carefully
2. Verify your database connection
3. Ensure you have the necessary permissions
4. Try the different script methods (Node.js, PowerShell, SQL)
5. Check the troubleshooting section above

The scripts are designed to be safe and informative, so they should guide you through any issues you encounter.

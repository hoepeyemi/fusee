# Database Cleanup Scripts

This directory contains scripts to clean up the database by deleting all data or dropping all tables.

## ⚠️ WARNING

**These scripts will permanently delete ALL data in the database!**
**This action cannot be undone!**

## Available Scripts

### 1. Node.js Script (`delete-all-tables.js`)

The most comprehensive script with multiple options and safety checks.

#### Usage:
```bash
# Interactive mode (recommended)
yarn db:clean

# Skip confirmation prompts
yarn db:clean:confirm

# Dry run (see what would be deleted without actually deleting)
yarn db:clean:dry

# Drop all tables (nuclear option)
yarn db:clean:drop

# Or run directly
node scripts/delete-all-tables.js
node scripts/delete-all-tables.js --confirm
node scripts/delete-all-tables.js --dry-run
node scripts/delete-all-tables.js --drop-tables
```

#### Features:
- ✅ Interactive confirmation prompts
- ✅ Dry run mode to preview changes
- ✅ Two cleanup methods: delete records vs drop tables
- ✅ Proper foreign key constraint handling
- ✅ Detailed progress reporting
- ✅ Error handling and recovery
- ✅ Summary statistics

### 2. PowerShell Script (`delete-all-tables.ps1`)

Windows PowerShell version of the cleanup script.

#### Usage:
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

### 3. SQL Script (`delete-all-tables.sql`)

Raw SQL script for direct database execution.

#### Usage:
```bash
# Using psql
psql -d your_database -f scripts/delete-all-tables.sql

# Using Prisma
npx prisma db execute --file scripts/delete-all-tables.sql
```

## Tables Affected

The scripts will process the following tables in the correct order (respecting foreign key constraints):

1. `multisig_approvals`
2. `multisig_proposals`
3. `multisig_transactions`
4. `multisig_members`
5. `multisigs`
6. `external_fees`
7. `external_transfers`
8. `wallet_fees`
9. `wallet_transfers`
10. `fees`
11. `transfers`
12. `withdrawals`
13. `deposits`
14. `vaults`
15. `wallets`
16. `users`

## Cleanup Methods

### Method 1: Delete Records (Recommended)
- Deletes all records from tables
- Preserves table structure
- Can be undone by restoring from backup
- Safer option

### Method 2: Drop Tables (Nuclear Option)
- Completely removes tables from database
- Requires running migrations to recreate tables
- Cannot be undone without backup
- More thorough cleanup

## Safety Features

- **Confirmation Prompts**: All scripts ask for confirmation before proceeding
- **Dry Run Mode**: Preview what would be deleted without making changes
- **Foreign Key Handling**: Properly disables/enables constraints during cleanup
- **Error Recovery**: Continues processing even if some tables fail
- **Progress Reporting**: Shows detailed progress and results
- **Summary Statistics**: Reports how many records/tables were affected

## Examples

### Quick Cleanup (Interactive)
```bash
yarn db:clean
# Follow the prompts to choose your cleanup method
```

### Automated Cleanup (CI/CD)
```bash
yarn db:clean:confirm
# Skips all prompts and deletes all records
```

### Preview Changes
```bash
yarn db:clean:dry
# Shows what would be deleted without actually deleting
```

### Complete Reset
```bash
yarn db:clean:drop
# Drops all tables (requires running migrations afterward)
```

## After Cleanup

If you used the "drop tables" method, you'll need to recreate the database schema:

```bash
# Push the schema to recreate all tables
yarn db:push

# Or run migrations if you have them
yarn db:migrate
```

## Backup Recommendation

Before running any cleanup script, consider creating a backup:

```bash
# Using pg_dump
pg_dump your_database > backup.sql

# Using Prisma
npx prisma db pull
```

## Troubleshooting

### Permission Errors
If you get permission errors, ensure your database user has the necessary privileges:
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

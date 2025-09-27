-- Database Cleanup SQL Script
-- 
-- This script deletes all data from all tables in the database.
-- 
-- WARNING: This will permanently delete ALL data in the database!
-- This action cannot be undone!
-- 
-- Usage:
--   psql -d your_database -f scripts/delete-all-tables.sql
--   Or run through Prisma: npx prisma db execute --file scripts/delete-all-tables.sql

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- Delete all records from tables (in reverse dependency order)
-- This ensures foreign key constraints are respected

-- Multisig related tables
DELETE FROM "multisig_approvals";
DELETE FROM "multisig_proposals";
DELETE FROM "multisig_transactions";
DELETE FROM "multisig_members";
DELETE FROM "multisigs";

-- External transfer related tables
DELETE FROM "external_fees";
DELETE FROM "external_transfers";

-- Wallet transfer related tables
DELETE FROM "wallet_fees";
DELETE FROM "wallet_transfers";

-- Transfer related tables
DELETE FROM "fees";
DELETE FROM "transfers";

-- Vault related tables
DELETE FROM "withdrawals";
DELETE FROM "deposits";
DELETE FROM "vaults";

-- Core tables
DELETE FROM "wallets";
DELETE FROM "users";

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;

-- Show summary
SELECT 
    'multisig_approvals' as table_name, COUNT(*) as record_count FROM "multisig_approvals"
UNION ALL
SELECT 'multisig_proposals', COUNT(*) FROM "multisig_proposals"
UNION ALL
SELECT 'multisig_transactions', COUNT(*) FROM "multisig_transactions"
UNION ALL
SELECT 'multisig_members', COUNT(*) FROM "multisig_members"
UNION ALL
SELECT 'multisigs', COUNT(*) FROM "multisigs"
UNION ALL
SELECT 'external_fees', COUNT(*) FROM "external_fees"
UNION ALL
SELECT 'external_transfers', COUNT(*) FROM "external_transfers"
UNION ALL
SELECT 'wallet_fees', COUNT(*) FROM "wallet_fees"
UNION ALL
SELECT 'wallet_transfers', COUNT(*) FROM "wallet_transfers"
UNION ALL
SELECT 'fees', COUNT(*) FROM "fees"
UNION ALL
SELECT 'transfers', COUNT(*) FROM "transfers"
UNION ALL
SELECT 'withdrawals', COUNT(*) FROM "withdrawals"
UNION ALL
SELECT 'deposits', COUNT(*) FROM "deposits"
UNION ALL
SELECT 'vaults', COUNT(*) FROM "vaults"
UNION ALL
SELECT 'wallets', COUNT(*) FROM "wallets"
UNION ALL
SELECT 'users', COUNT(*) FROM "users"
ORDER BY record_count DESC;

-- Alternative: Drop all tables (nuclear option)
-- Uncomment the following lines if you want to drop all tables instead of just deleting data
-- 
-- DROP TABLE IF EXISTS "multisig_approvals" CASCADE;
-- DROP TABLE IF EXISTS "multisig_proposals" CASCADE;
-- DROP TABLE IF EXISTS "multisig_transactions" CASCADE;
-- DROP TABLE IF EXISTS "multisig_members" CASCADE;
-- DROP TABLE IF EXISTS "multisigs" CASCADE;
-- DROP TABLE IF EXISTS "external_fees" CASCADE;
-- DROP TABLE IF EXISTS "external_transfers" CASCADE;
-- DROP TABLE IF EXISTS "wallet_fees" CASCADE;
-- DROP TABLE IF EXISTS "wallet_transfers" CASCADE;
-- DROP TABLE IF EXISTS "fees" CASCADE;
-- DROP TABLE IF EXISTS "transfers" CASCADE;
-- DROP TABLE IF EXISTS "withdrawals" CASCADE;
-- DROP TABLE IF EXISTS "deposits" CASCADE;
-- DROP TABLE IF EXISTS "vaults" CASCADE;
-- DROP TABLE IF EXISTS "wallets" CASCADE;
-- DROP TABLE IF EXISTS "users" CASCADE;

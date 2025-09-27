# Database Cleanup Script (PowerShell)
# 
# This script deletes all tables in the database.
# 
# WARNING: This will permanently delete ALL data in the database!
# 
# Usage:
#   .\scripts\delete-all-tables.ps1
#   .\scripts\delete-all-tables.ps1 -Confirm
#   .\scripts\delete-all-tables.ps1 -DryRun

param(
    [switch]$Confirm,
    [switch]$DryRun,
    [switch]$DropTables
)

# Import required modules
try {
    Import-Module -Name "Prisma" -ErrorAction Stop
} catch {
    Write-Host "❌ Prisma module not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g prisma" -ForegroundColor Yellow
    exit 1
}

# Define all tables in the correct order (respecting foreign key constraints)
$tables = @(
    # Tables with foreign keys first (in reverse dependency order)
    "multisig_approvals",
    "multisig_proposals", 
    "multisig_transactions",
    "multisig_members",
    "multisigs",
    "external_fees",
    "external_transfers",
    "wallet_fees",
    "wallet_transfers",
    "fees",
    "withdrawals",
    "deposits",
    "transfers",
    "wallets",
    "vaults",
    "users"
)

# Function to show table information
function Show-TableInfo {
    Write-Host "📋 Current database tables and record counts:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($table in $tables) {
        try {
            $result = prisma db execute --stdin
            $query = "SELECT COUNT(*) as count FROM `"$table`";"
            $count = $result | ConvertFrom-Json | Select-Object -ExpandProperty count
            Write-Host "   $table`: $count records" -ForegroundColor White
        } catch {
            Write-Host "   $table`: Error - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Function to delete all records from tables
function Remove-AllTableData {
    Write-Host "🗑️  Starting database cleanup..." -ForegroundColor Yellow
    Write-Host ""
    
    $deletedCount = 0
    $errors = @()
    
    foreach ($table in $tables) {
        try {
            Write-Host "Deleting table: $table..." -ForegroundColor White
            
            $query = "DELETE FROM `"$table`";"
            $result = prisma db execute --stdin
            $query | $result
            
            Write-Host "✅ Deleted records from $table" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "❌ Error deleting $table`: $($_.Exception.Message)" -ForegroundColor Red
            $errors += @{ Table = $table; Error = $_.Exception.Message }
        }
    }
    
    Write-Host ""
    Write-Host "📊 Summary:" -ForegroundColor Cyan
    Write-Host "   Total tables processed: $deletedCount" -ForegroundColor White
    Write-Host "   Tables processed: $($tables.Count)" -ForegroundColor White
    Write-Host "   Errors: $($errors.Count)" -ForegroundColor White
    
    if ($errors.Count -gt 0) {
        Write-Host ""
        Write-Host "❌ Errors encountered:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "   $($error.Table): $($error.Error)" -ForegroundColor Red
        }
    }
    
    return @{ DeletedCount = $deletedCount; Errors = $errors }
}

# Function to drop all tables (nuclear option)
function Remove-AllTables {
    Write-Host "💥 DROPPING ALL TABLES (Nuclear Option)..." -ForegroundColor Red
    Write-Host ""
    
    $errors = @()
    
    foreach ($table in $tables) {
        try {
            Write-Host "Dropping table: $table..." -ForegroundColor White
            
            $query = "DROP TABLE IF EXISTS `"$table`" CASCADE;"
            prisma db execute --stdin
            $query | prisma db execute --stdin
            
            Write-Host "✅ Dropped table $table" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error dropping $table`: $($_.Exception.Message)" -ForegroundColor Red
            $errors += @{ Table = $table; Error = $_.Exception.Message }
        }
    }
    
    Write-Host ""
    Write-Host "📊 Summary:" -ForegroundColor Cyan
    Write-Host "   Tables dropped: $($tables.Count - $errors.Count)" -ForegroundColor White
    Write-Host "   Errors: $($errors.Count)" -ForegroundColor White
    
    if ($errors.Count -gt 0) {
        Write-Host ""
        Write-Host "❌ Errors encountered:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "   $($error.Table): $($error.Error)" -ForegroundColor Red
        }
    }
    
    return @{ Errors = $errors }
}

# Main execution
try {
    Write-Host "🗄️  Database Cleanup Script" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    Write-Host ""
    
    # Show current table information
    Show-TableInfo
    
    if ($DryRun) {
        Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Tables that would be affected:" -ForegroundColor White
        foreach ($table in $tables) {
            Write-Host "   - $table" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "To actually delete data, run without -DryRun flag" -ForegroundColor Yellow
        return
    }
    
    if (-not $Confirm) {
        Write-Host "⚠️  WARNING: This will permanently delete ALL data in the database!" -ForegroundColor Red
        Write-Host "⚠️  This action cannot be undone!" -ForegroundColor Red
        Write-Host ""
        
        $userConfirm = Read-Host "Are you sure you want to continue? (yes/no)"
        if ($userConfirm -ne "yes" -and $userConfirm -ne "y") {
            Write-Host "❌ Operation cancelled by user" -ForegroundColor Yellow
            return
        }
        
        Write-Host ""
        Write-Host "Choose cleanup method:" -ForegroundColor White
        Write-Host "1. Delete all records (recommended)" -ForegroundColor White
        Write-Host "2. Drop all tables (nuclear option)" -ForegroundColor White
        $method = Read-Host "Enter 1 or 2"
        
        if ($method -eq "2") {
            $confirmDrop = Read-Host "⚠️  This will DROP ALL TABLES! Are you absolutely sure? (yes/no)"
            if ($confirmDrop -ne "yes" -and $confirmDrop -ne "y") {
                Write-Host "❌ Operation cancelled by user" -ForegroundColor Yellow
                return
            }
            $DropTables = $true
        }
    }
    
    Write-Host ""
    Write-Host "🚀 Starting cleanup..." -ForegroundColor Green
    Write-Host ""
    
    if ($DropTables) {
        $result = Remove-AllTables
    } else {
        $result = Remove-AllTableData
    }
    
    if ($result.Errors.Count -eq 0) {
        Write-Host ""
        Write-Host "✅ Database cleanup completed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Database cleanup completed with some errors" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Fatal error during cleanup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

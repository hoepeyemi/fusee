# Multisig Feature Test Script
Write-Host "🔐 Starting Multisig Feature Test..." -ForegroundColor Green

try {
    # Step 1: Get CSRF Token
    Write-Host "`n1️⃣ Getting CSRF token..." -ForegroundColor Yellow
    $csrfResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/csrf-token" -Method GET
    $csrfToken = ($csrfResponse.Content | ConvertFrom-Json).csrfToken
    Write-Host "✅ CSRF Token: $($csrfToken.Substring(0, 20))..." -ForegroundColor Green

    # Step 2: Create a test user
    Write-Host "`n2️⃣ Creating test user..." -ForegroundColor Yellow
    $userData = @{
        email = "multisigtest@example.com"
        fullName = "Multisig Test User"
        solanaWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
    } | ConvertTo-Json

    $userHeaders = @{
        "Content-Type" = "application/json"
        "X-CSRF-Token" = $csrfToken
    }

    $userResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/users" -Method POST -Body $userData -Headers $userHeaders
    $userResult = $userResponse.Content | ConvertFrom-Json
    Write-Host "✅ User created with ID: $($userResult.id)" -ForegroundColor Green
    $userId = $userResult.id

    # Step 3: Create multisig
    Write-Host "`n3️⃣ Creating multisig..." -ForegroundColor Yellow
    $multisigData = @{
        name = "Test Multisig"
        threshold = 2
        timeLock = 0
        members = @(
            @{
                publicKey = "11111111111111111111111111111112"
                permissions = @("propose", "vote", "execute")
            },
            @{
                publicKey = "22222222222222222222222222222223"
                permissions = @("vote")
            },
            @{
                publicKey = "33333333333333333333333333333334"
                permissions = @("vote")
            }
        )
    } | ConvertTo-Json -Depth 3

    $multisigResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/multisig/create" -Method POST -Body $multisigData -Headers $userHeaders
    $multisigResult = $multisigResponse.Content | ConvertFrom-Json
    Write-Host "✅ Multisig created with PDA: $($multisigResult.data.multisigPda)" -ForegroundColor Green
    $multisigPda = $multisigResult.data.multisigPda

    # Step 4: Test external transfer
    Write-Host "`n4️⃣ Testing external transfer..." -ForegroundColor Yellow
    $transferData = @{
        userId = $userId
        toExternalWallet = "ExternalWallet1234567890123456789012345678901234567890"
        amount = 1.5
        notes = "Test multisig external transfer"
    } | ConvertTo-Json

    $transferResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/external-transfers" -Method POST -Body $transferData -Headers $userHeaders
    $transferResult = $transferResponse.Content | ConvertFrom-Json
    Write-Host "✅ External transfer response: $($transferResult.message)" -ForegroundColor Green

    # Step 5: Create vault transaction
    Write-Host "`n5️⃣ Creating vault transaction..." -ForegroundColor Yellow
    $vaultTxData = @{
        fromWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAudM"
        toWallet = "ExternalWallet1234567890123456789012345678901234567890"
        amount = 1.5
        currency = "SOL"
        memo = "Test multisig vault transaction"
    } | ConvertTo-Json

    $vaultTxResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/multisig/$multisigPda/transactions" -Method POST -Body $vaultTxData -Headers $userHeaders
    $vaultTxResult = $vaultTxResponse.Content | ConvertFrom-Json
    Write-Host "✅ Vault transaction created with index: $($vaultTxResult.data.transactionIndex)" -ForegroundColor Green

    Write-Host "`n🎉 Multisig feature test completed successfully!" -ForegroundColor Green

} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

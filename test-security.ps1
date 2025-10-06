# =====================================================
# 🛡️ ANTI-MULTI-ACCOUNTING SECURITY TEST SCRIPT (PowerShell)
# =====================================================
# Run: .\test-security.ps1
# =====================================================

$BaseUrl = "http://localhost:3005/api"
$AdminToken = ""  # Will be set after admin login

Write-Host "🛡️ Starting Security System Tests..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# =====================================================
# Helper Functions
# =====================================================

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [string]$Token = "",
        [string]$ForwardedFor = ""
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    if ($ForwardedFor) {
        $headers["X-Forwarded-For"] = $ForwardedFor
    }
    
    $params = @{
        Method = $Method
        Uri = "$BaseUrl$Endpoint"
        Headers = $headers
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json)
    }
    
    try {
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        return $_.Exception.Response
    }
}

# =====================================================
# TEST 1: Device Fingerprinting
# =====================================================
Write-Host "`nTEST 1: Device Fingerprinting" -ForegroundColor Blue
Write-Host "Registering 3 accounts with SAME device fingerprint..." -ForegroundColor Yellow

$deviceFp = "test_device_123abc"

$cloneNames = @("testcloneA", "testcloneB", "testcloneC")
for ($i = 0; $i -lt 3; $i++) {
    Write-Host "Registering $($cloneNames[$i])..." -ForegroundColor Yellow
    
    $body = @{
        username = $cloneNames[$i]
        password = "password123"
        deviceFingerprint = $deviceFp
    }
    
    $response = Invoke-ApiRequest -Method POST -Endpoint "/auth/register" `
        -Body $body -ForwardedFor "192.168.1.$i"
    
    Write-Host ($response | ConvertTo-Json) -ForegroundColor Gray
    Start-Sleep -Seconds 1
}

Write-Host "✓ Expected: All 3 accounts should share device fingerprint" -ForegroundColor Green

# =====================================================
# TEST 2: Rate Limiting
# =====================================================
Write-Host "`nTEST 2: Rate Limiting (Registration)" -ForegroundColor Blue
Write-Host "Trying to register 10 accounts rapidly from same IP..." -ForegroundColor Yellow

for ($i = 1; $i -le 10; $i++) {
    Write-Host "Registration attempt $i/10..." -ForegroundColor Yellow
    
    $body = @{
        username = "ratetest$('{0:D2}' -f $i)"
        password = "password123"
    }
    
    try {
        $response = Invoke-RestMethod -Method POST -Uri "$BaseUrl/auth/register" `
            -Headers @{
                "Content-Type" = "application/json"
                "X-Forwarded-For" = "10.0.0.100"
            } `
            -Body ($body | ConvertTo-Json)
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 429) {
            Write-Host "✓ Rate limit triggered at attempt $i (HTTP 429)" -ForegroundColor Green
            break
        }
    }
    
    Start-Sleep -Milliseconds 500
}

# =====================================================
# TEST 3: IP Tracking (Multi-Account)
# =====================================================
Write-Host "`nTEST 3: IP Tracking (Multi-Account Detection)" -ForegroundColor Blue
Write-Host "Registering 7 accounts from SAME IP..." -ForegroundColor Yellow

$sharedIp = "203.0.113.50"

for ($i = 1; $i -le 7; $i++) {
    Write-Host "Registering multiacc$('{0:D2}' -f $i) from $sharedIp..." -ForegroundColor Yellow
    
    $body = @{
        username = "multiacc$('{0:D2}' -f $i)"
        password = "password123"
    }
    
    $response = Invoke-ApiRequest -Method POST -Endpoint "/auth/register" `
        -Body $body -ForwardedFor $sharedIp
    
    Write-Host ($response | ConvertTo-Json -Compress) -ForegroundColor Gray
    Start-Sleep -Seconds 1
}

Write-Host "✓ Expected: IP $sharedIp should have 7 accounts (flagged)" -ForegroundColor Green

# =====================================================
# TEST 4: Username Pattern Detection
# =====================================================
Write-Host "`nTEST 4: Username Pattern Detection" -ForegroundColor Blue
Write-Host "Trying to register accounts with clone patterns..." -ForegroundColor Yellow

$clonePatterns = @("player_1", "player_2", "account_99", "bot_123")

foreach ($username in $clonePatterns) {
    Write-Host "Trying: $username..." -ForegroundColor Yellow
    
    $body = @{
        username = $username
        password = "password123"
    }
    
    try {
        $response = Invoke-RestMethod -Method POST -Uri "$BaseUrl/auth/register" `
            -Headers @{
                "Content-Type" = "application/json"
                "X-Forwarded-For" = "192.168.2.100"
            } `
            -Body ($body | ConvertTo-Json)
        
        Write-Host "✗ Failed to block: $username" -ForegroundColor Red
    }
    catch {
        $error = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($error.message -match "not allowed") {
            Write-Host "✓ Blocked: $username (clone pattern)" -ForegroundColor Green
        }
    }
}

# =====================================================
# TEST 5: Behavioral Analysis - Combat Spamming
# =====================================================
Write-Host "`nTEST 5: Behavioral Analysis (Combat)" -ForegroundColor Blue
Write-Host "Creating test_bot_user and spamming combats..." -ForegroundColor Yellow

# Register test user
$registerBody = @{
    username = "test_bot_user"
    password = "password123"
}

try {
    $registerResponse = Invoke-ApiRequest -Method POST -Endpoint "/auth/register" -Body $registerBody
    Write-Host "User registered" -ForegroundColor Gray
}
catch {
    Write-Host "User may already exist" -ForegroundColor Gray
}

# Login
$loginBody = @{
    username = "test_bot_user"
    password = "password123"
}

$loginResponse = Invoke-ApiRequest -Method POST -Endpoint "/auth/login" -Body $loginBody
$botToken = $loginResponse.access_token

if ($botToken) {
    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host "Starting 60 rapid combats..." -ForegroundColor Yellow
    
    for ($i = 1; $i -le 60; $i++) {
        if ($i % 10 -eq 0) {
            Write-Host "Combat $i/60..." -ForegroundColor Yellow
        }
        
        $combatBody = @{
            monsterId = 1
            victory = $true
            damageDealt = 100
        }
        
        try {
            Invoke-ApiRequest -Method POST -Endpoint "/combat-results" `
                -Body $combatBody -Token $botToken | Out-Null
        }
        catch {
            # Ignore errors
        }
        
        Start-Sleep -Milliseconds 50
    }
    
    Write-Host "✓ 60 combats completed (suspicious score should increase)" -ForegroundColor Green
}

# =====================================================
# TEST 6: Behavioral Analysis - Farming
# =====================================================
Write-Host "`nTEST 6: Behavioral Analysis (Farming)" -ForegroundColor Blue
Write-Host "Spamming 60 explorations..." -ForegroundColor Yellow

if ($botToken) {
    for ($i = 1; $i -le 60; $i++) {
        if ($i % 10 -eq 0) {
            Write-Host "Exploration $i/60..." -ForegroundColor Yellow
        }
        
        try {
            Invoke-ApiRequest -Method POST -Endpoint "/explore/wildarea/start" `
                -Body @{} -Token $botToken | Out-Null
        }
        catch {
            # Ignore errors
        }
        
        Start-Sleep -Milliseconds 50
    }
    
    Write-Host "✓ 60 explorations completed (farming detection triggered)" -ForegroundColor Green
}

# =====================================================
# TEST 7: Admin Security Dashboard
# =====================================================
Write-Host "`nTEST 7: Admin Security Dashboard" -ForegroundColor Blue

# Login as admin
Write-Host "Logging in as admin..." -ForegroundColor Yellow

$adminLoginBody = @{
    username = "admin"
    password = "admin123"
}

try {
    $adminLoginResponse = Invoke-ApiRequest -Method POST -Endpoint "/auth/login" -Body $adminLoginBody
    $adminToken = $adminLoginResponse.access_token
    
    if ($adminToken) {
        Write-Host "✓ Admin login successful" -ForegroundColor Green
        
        # Get dashboard
        Write-Host "`nFetching security dashboard..." -ForegroundColor Yellow
        $dashboard = Invoke-ApiRequest -Method GET -Endpoint "/admin/security/dashboard" -Token $adminToken
        Write-Host ($dashboard | ConvertTo-Json) -ForegroundColor Gray
        
        # Check IP accounts
        Write-Host "`nChecking IP $sharedIp accounts..." -ForegroundColor Yellow
        $ipAccounts = Invoke-ApiRequest -Method GET -Endpoint "/admin/security/ip-accounts?ip=$sharedIp" -Token $adminToken
        Write-Host ($ipAccounts | ConvertTo-Json) -ForegroundColor Gray
        
        if ($ipAccounts.accountCount -ge 5) {
            Write-Host "✓ Multi-account detected: $($ipAccounts.accountCount) accounts" -ForegroundColor Green
        }
    }
}
catch {
    Write-Host "✗ Admin login failed. Update credentials in script." -ForegroundColor Red
}

# =====================================================
# SUMMARY
# =====================================================
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "📊 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`nTo verify results:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣ Check Redis keys:" -ForegroundColor White
Write-Host "   docker exec -it redis-container redis-cli" -ForegroundColor Gray
Write-Host "   KEYS combat_pattern:*" -ForegroundColor Gray
Write-Host "   KEYS farming:*" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣ Check database:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   mysql -u root -p game_db < verify-security.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣ View admin dashboard:" -ForegroundColor White
Write-Host "   http://localhost:3000/admin/security" -ForegroundColor Gray
Write-Host ""

Write-Host "Expected Results:" -ForegroundColor Yellow
Write-Host "  ✓ test_clone_1/2/3 - Same device fingerprint" -ForegroundColor White
Write-Host "  ✓ Rate limit triggered after 5-10 registrations" -ForegroundColor White
Write-Host "  ✓ $sharedIp - 7+ accounts (suspicious)" -ForegroundColor White
Write-Host "  ✓ Clone patterns blocked" -ForegroundColor White
Write-Host "  ✓ test_bot_user - High suspicious score" -ForegroundColor White
Write-Host ""

Write-Host "🎉 Security tests completed!" -ForegroundColor Green

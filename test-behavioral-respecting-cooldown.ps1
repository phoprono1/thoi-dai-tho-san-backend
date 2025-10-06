#!/usr/bin/env pwsh
# Test behavioral tracking WITH cooldown respect (11s delay between actions)

Write-Host "`n🧪 Testing Behavioral Tracking (Respecting 10s Cooldown)..." -ForegroundColor Cyan
Write-Host "This will take ~55 seconds (5 combats x 11s)" -ForegroundColor Yellow

# Login as test_bot_user
$loginBody = @{
    username = "test_bot_user"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "http://localhost:3005/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResp.access_token
    Write-Host "✓ Logged in as test_bot_user`n" -ForegroundColor Green
} catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Spam 5 combats with 11s delay (respecting 10s cooldown)
Write-Host "Starting 5 combats (11s delay each)..." -ForegroundColor Yellow
for ($i = 1; $i -le 5; $i++) {
    try {
        $exploreBody = @{
            level = 1
            count = 1
        } | ConvertTo-Json
        
        $result = Invoke-RestMethod -Uri "http://localhost:3005/api/explore/wildarea/start" -Method POST -Body $exploreBody -ContentType "application/json" -Headers @{Authorization = "Bearer $token"}
        
        Write-Host "  Combat $i/5 completed" -ForegroundColor Green
        
        if ($i -lt 5) {
            Write-Host "  Waiting 11s for cooldown..." -ForegroundColor Gray
            Start-Sleep -Seconds 11
        }
    } catch {
        Write-Host "  Combat $i/5 failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n✓ Test completed!`n" -ForegroundColor Green

# Check Redis data
Write-Host "📊 Redis Data After Test:" -ForegroundColor Cyan
Write-Host "Combat timestamps: " -NoNewline
docker exec thoi-dai-tho-san-redis-1 redis-cli LLEN combat_pattern:22

Write-Host "Farming actions: " -NoNewline
$hour = (Get-Date).ToString("yyyy-MM-ddTHH")
docker exec thoi-dai-tho-san-redis-1 redis-cli HGET "farming:22:$hour" explore

Write-Host "`nExpected: 5 combat timestamps + 5 farming actions`n" -ForegroundColor Yellow

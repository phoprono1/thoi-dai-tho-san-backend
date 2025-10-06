# =====================================================
# 🔍 CHECK REDIS BEHAVIORAL DATA
# =====================================================
# Kiểm tra Redis keys để verify behavioral analysis
# =====================================================

Write-Host "🔍 Checking Redis behavioral data..." -ForegroundColor Cyan

# Check combat pattern for user 22 (test_bot_user)
Write-Host "`n📊 Combat Pattern (User 22):" -ForegroundColor Yellow
docker exec thoi-dai-tho-san-redis-1 redis-cli HGETALL "combat_pattern:22"

# Check farming pattern for user 22
Write-Host "`n🌾 Farming Pattern (User 22):" -ForegroundColor Yellow
docker exec thoi-dai-tho-san-redis-1 redis-cli HGETALL "farming:22"

# Check suspicious accounts list
Write-Host "`n🚨 Suspicious Accounts:" -ForegroundColor Yellow
docker exec thoi-dai-tho-san-redis-1 redis-cli SMEMBERS "suspicious_accounts"

# Check all keys matching patterns
Write-Host "`n🔑 All Combat Pattern Keys:" -ForegroundColor Yellow
docker exec thoi-dai-tho-san-redis-1 redis-cli KEYS "combat_pattern:*"

Write-Host "`n🔑 All Farming Keys:" -ForegroundColor Yellow
docker exec thoi-dai-tho-san-redis-1 redis-cli KEYS "farming:*"

# Check IP tracking
Write-Host "`n🌐 IP Tracking (203.0.113.50):" -ForegroundColor Yellow
docker exec thoi-dai-tho-san-redis-1 redis-cli SMEMBERS "ip:203.0.113.50"

Write-Host "`n✅ Redis check completed!" -ForegroundColor Green

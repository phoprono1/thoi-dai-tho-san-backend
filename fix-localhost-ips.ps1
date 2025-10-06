# =====================================================
# 🔧 FIX LOCALHOST IP FOR TESTING
# =====================================================
# This script updates ::1 IPs to real IPs for testing
# Run: .\fix-localhost-ips.ps1
# =====================================================

Write-Host "🔧 Fixing localhost IPs for testing..." -ForegroundColor Cyan

# Database connection details
$dbHost = "localhost"
$dbUser = "postgres"
$dbPassword = "hoangpho"  # UPDATE THIS
$dbName = "thoi_dai_tho_san_v2"

# Fake IPs to assign (for testing multi-account detection)
$testIPs = @(
    "203.0.113.10",
    "203.0.113.11",
    "203.0.113.12",
    "203.0.113.13",
    "203.0.113.14",
    "203.0.113.15",
    "203.0.113.20",  # This IP will have multiple accounts
    "203.0.113.20",
    "203.0.113.20",
    "203.0.113.20",
    "203.0.113.20",
    "203.0.113.20",
    "203.0.113.20"
)

Write-Host "Generating SQL to update IPs..." -ForegroundColor Yellow

$sql = @"
-- Update existing users with fake IPs for testing
UPDATE users SET registrationIp = '203.0.113.10', lastLoginIp = '203.0.113.10' WHERE id = 1;
UPDATE users SET registrationIp = '203.0.113.11', lastLoginIp = '203.0.113.11' WHERE id = 2;
UPDATE users SET registrationIp = '203.0.113.12', lastLoginIp = '203.0.113.12' WHERE id = 3;
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 4;  -- Admin - will share IP
UPDATE users SET registrationIp = '203.0.113.13', lastLoginIp = '203.0.113.13' WHERE id = 6;
UPDATE users SET registrationIp = '203.0.113.14', lastLoginIp = '203.0.113.14' WHERE id = 7;
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 8;  -- Shares IP with admin
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 9;  -- Shares IP with admin
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 10; -- Shares IP with admin
UPDATE users SET registrationIp = '203.0.113.15', lastLoginIp = '203.0.113.15' WHERE id = 11;
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 12; -- Shares IP with admin
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 13; -- Shares IP with admin
UPDATE users SET registrationIp = '203.0.113.16', lastLoginIp = '203.0.113.16' WHERE id = 14;
UPDATE users SET registrationIp = '203.0.113.17', lastLoginIp = '203.0.113.17' WHERE id = 17;
UPDATE users SET registrationIp = '203.0.113.20', lastLoginIp = '203.0.113.20' WHERE id = 21; -- Shares IP with admin

-- Add device fingerprints to some accounts (simulate same device)
UPDATE users SET deviceFingerprints = 'device_abc123' WHERE id IN (4, 8, 9);   -- 3 accounts same device
UPDATE users SET deviceFingerprints = 'device_xyz789' WHERE id IN (10, 12);    -- 2 accounts same device
UPDATE users SET deviceFingerprints = 'device_unique1' WHERE id = 1;
UPDATE users SET deviceFingerprints = 'device_unique2' WHERE id = 2;
UPDATE users SET deviceFingerprints = 'device_unique3' WHERE id = 3;

-- Flag suspicious accounts (simulate behavioral analysis)
UPDATE users SET isSuspicious = TRUE, suspiciousScore = 65 WHERE id = 8;  -- High score
UPDATE users SET isSuspicious = TRUE, suspiciousScore = 45 WHERE id = 9;  -- Medium score
UPDATE users SET isSuspicious = TRUE, suspiciousScore = 30 WHERE id = 10; -- Low score

SELECT '✓ IPs updated successfully!' as status;
"@

# Save to file
$sql | Out-File -FilePath "fix-ips.sql" -Encoding utf8

Write-Host "✓ SQL script generated: fix-ips.sql" -ForegroundColor Green
Write-Host ""
Write-Host "To apply changes, run:" -ForegroundColor Yellow
Write-Host "  mysql -u root -p game_db < fix-ips.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or manually in MySQL Workbench:" -ForegroundColor Yellow
Write-Host "  1. Open fix-ips.sql" -ForegroundColor Gray
Write-Host "  2. Execute all queries" -ForegroundColor Gray
Write-Host ""

# =====================================================
# Verification queries
# =====================================================
$verifySQL = @"
-- Verify IP distribution
SELECT 
    registrationIp,
    COUNT(*) as account_count,
    GROUP_CONCAT(username SEPARATOR ', ') as usernames
FROM users
WHERE registrationIp IS NOT NULL
GROUP BY registrationIp
ORDER BY account_count DESC;

-- Verify device fingerprints
SELECT 
    deviceFingerprints,
    COUNT(*) as account_count,
    GROUP_CONCAT(username SEPARATOR ', ') as usernames
FROM users
WHERE deviceFingerprints IS NOT NULL
GROUP BY deviceFingerprints
HAVING COUNT(*) > 1
ORDER BY account_count DESC;

-- Verify suspicious accounts
SELECT 
    id,
    username,
    isSuspicious,
    suspiciousScore,
    registrationIp,
    deviceFingerprints
FROM users
WHERE isSuspicious = TRUE
ORDER BY suspiciousScore DESC;
"@

$verifySQL | Out-File -FilePath "verify-ips.sql" -Encoding utf8

Write-Host "✓ Verification script generated: verify-ips.sql" -ForegroundColor Green
Write-Host ""
Write-Host "After applying changes, verify with:" -ForegroundColor Yellow
Write-Host "  mysql -u root -p game_db < verify-ips.sql" -ForegroundColor Cyan
Write-Host ""

Write-Host "Expected results:" -ForegroundColor Yellow
Write-Host "  • IP 203.0.113.20 should have 7+ accounts (multi-accounting)" -ForegroundColor White
Write-Host "  • device_abc123 should have 3 accounts (device sharing)" -ForegroundColor White
Write-Host "  • 3 accounts should be flagged as suspicious" -ForegroundColor White
Write-Host ""

Write-Host "🎉 Done! Apply the SQL and run test-security.ps1" -ForegroundColor Green

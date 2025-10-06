-- =====================================================
-- 🛡️ SECURITY VERIFICATION QUERIES
-- =====================================================
-- Run these queries to verify security system working
-- mysql -u root -p game_db < verify-security.sql
-- =====================================================

-- 1️⃣ CHECK DEVICE FINGERPRINTING
-- Should see multiple accounts with same fingerprint
SELECT 
    id,
    username,
    deviceFingerprints,
    registrationIp,
    isSuspicious,
    suspiciousScore,
    createdAt
FROM users
WHERE deviceFingerprints IS NOT NULL
  AND deviceFingerprints != ''
ORDER BY deviceFingerprints, createdAt;

-- 2️⃣ CHECK MULTI-ACCOUNT IPs
-- Should see IPs with 5+ accounts
SELECT 
    registrationIp as ip_address,
    COUNT(*) as account_count,
    GROUP_CONCAT(username ORDER BY createdAt SEPARATOR ', ') as accounts,
    MIN(createdAt) as first_account,
    MAX(createdAt) as last_account
FROM users
WHERE registrationIp IS NOT NULL
  AND registrationIp != ''
  AND registrationIp != '::1'
  AND registrationIp != '127.0.0.1'
GROUP BY registrationIp
HAVING COUNT(*) >= 5
ORDER BY account_count DESC;

-- 3️⃣ CHECK SUSPICIOUS ACCOUNTS
-- Should see flagged accounts with scores
SELECT 
    id,
    username,
    isSuspicious,
    suspiciousScore,
    registrationIp,
    lastLoginIp,
    deviceFingerprints,
    accountFlags,
    createdAt,
    TIMESTAMPDIFF(HOUR, createdAt, NOW()) as account_age_hours
FROM users
WHERE isSuspicious = TRUE
   OR suspiciousScore > 0
ORDER BY suspiciousScore DESC, createdAt DESC;

-- 4️⃣ CHECK CLONE USERNAME PATTERNS
-- Should see accounts with _1, _2, etc. patterns (if any slipped through)
SELECT 
    id,
    username,
    registrationIp,
    deviceFingerprints,
    isSuspicious,
    createdAt
FROM users
WHERE username REGEXP '.*_[0-9]{1,3}$'
ORDER BY username;

-- 5️⃣ CHECK RAPID LEVELING (Bot Accounts)
-- Accounts that leveled too fast
SELECT 
    id,
    username,
    level,
    experience,
    TIMESTAMPDIFF(HOUR, createdAt, NOW()) as account_age_hours,
    ROUND(level / TIMESTAMPDIFF(HOUR, createdAt, NOW()), 2) as levels_per_hour,
    isSuspicious,
    suspiciousScore
FROM users
WHERE level > 10
  AND TIMESTAMPDIFF(HOUR, createdAt, NOW()) < 24
ORDER BY levels_per_hour DESC;

-- 6️⃣ CHECK INACTIVE ALTS (Abandoned Accounts)
-- Low level accounts created days ago
SELECT 
    id,
    username,
    level,
    registrationIp,
    TIMESTAMPDIFF(DAY, createdAt, NOW()) as days_old,
    TIMESTAMPDIFF(DAY, lastLoginDate, NOW()) as days_since_login,
    isSuspicious
FROM users
WHERE level < 5
  AND TIMESTAMPDIFF(DAY, createdAt, NOW()) > 7
  AND (lastLoginDate IS NULL OR TIMESTAMPDIFF(DAY, lastLoginDate, NOW()) > 3)
ORDER BY days_old DESC;

-- 7️⃣ CHECK BANNED ACCOUNTS
-- Should see any banned accounts
SELECT 
    id,
    username,
    isBanned,
    tempBanUntil,
    banReason,
    suspiciousScore,
    registrationIp,
    createdAt
FROM users
WHERE isBanned = TRUE
   OR tempBanUntil IS NOT NULL
ORDER BY createdAt DESC;

-- 8️⃣ CHECK TEST ACCOUNTS CREATED BY SCRIPT
-- Should see all test_* accounts
SELECT 
    id,
    username,
    registrationIp,
    deviceFingerprints,
    isSuspicious,
    suspiciousScore,
    level,
    createdAt
FROM users
WHERE username LIKE 'test_%'
   OR username LIKE 'multi_acc_%'
   OR username LIKE 'rate_test_%'
ORDER BY createdAt DESC;

-- 9️⃣ TOP 10 MOST SUSPICIOUS ACCOUNTS
SELECT 
    id,
    username,
    suspiciousScore,
    isSuspicious,
    registrationIp,
    deviceFingerprints,
    level,
    TIMESTAMPDIFF(HOUR, createdAt, NOW()) as account_age_hours,
    accountFlags
FROM users
ORDER BY suspiciousScore DESC
LIMIT 10;

-- 🔟 SECURITY SYSTEM STATISTICS
SELECT 
    COUNT(*) as total_accounts,
    SUM(CASE WHEN isSuspicious = TRUE THEN 1 ELSE 0 END) as suspicious_accounts,
    SUM(CASE WHEN suspiciousScore > 40 THEN 1 ELSE 0 END) as high_risk_accounts,
    SUM(CASE WHEN isBanned = TRUE THEN 1 ELSE 0 END) as banned_accounts,
    SUM(CASE WHEN deviceFingerprints IS NOT NULL AND deviceFingerprints != '' THEN 1 ELSE 0 END) as accounts_with_fingerprint,
    COUNT(DISTINCT registrationIp) as unique_ips,
    ROUND(AVG(suspiciousScore), 2) as avg_suspicious_score
FROM users;

-- 1️⃣1️⃣ IPs WITH MOST ACCOUNTS (Top 20)
SELECT 
    registrationIp,
    COUNT(*) as account_count,
    SUM(CASE WHEN isSuspicious = TRUE THEN 1 ELSE 0 END) as suspicious_count,
    GROUP_CONCAT(DISTINCT username ORDER BY username SEPARATOR ', ') as usernames
FROM users
WHERE registrationIp IS NOT NULL
  AND registrationIp != ''
GROUP BY registrationIp
ORDER BY account_count DESC
LIMIT 20;

-- 1️⃣2️⃣ DEVICE FINGERPRINTS USED BY MULTIPLE ACCOUNTS
SELECT 
    deviceFingerprints,
    COUNT(*) as account_count,
    GROUP_CONCAT(username ORDER BY username SEPARATOR ', ') as accounts,
    COUNT(DISTINCT registrationIp) as unique_ips
FROM users
WHERE deviceFingerprints IS NOT NULL
  AND deviceFingerprints != ''
GROUP BY deviceFingerprints
HAVING COUNT(*) > 1
ORDER BY account_count DESC;

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

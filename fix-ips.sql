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

-- =====================================================
-- 🧹 CLEANUP TEST ACCOUNTS
-- =====================================================
-- Delete all test accounts created by security tests
-- =====================================================

-- Show test accounts before deletion
SELECT 'Before deletion:' as status;
SELECT id, username, registrationIp, deviceFingerprints, createdAt
FROM users
WHERE username LIKE 'test%'
   OR username LIKE 'multiacc%'
   OR username LIKE 'ratetest%'
ORDER BY id;

-- Count test accounts
SELECT COUNT(*) as test_account_count
FROM users
WHERE username LIKE 'test%'
   OR username LIKE 'multiacc%'
   OR username LIKE 'ratetest%';

-- Delete test accounts
DELETE FROM users
WHERE username LIKE 'test%'
   OR username LIKE 'multiacc%'
   OR username LIKE 'ratetest%';

SELECT 'Test accounts deleted successfully!' as status;

-- Verify deletion
SELECT 'After deletion:' as status;
SELECT COUNT(*) as remaining_test_accounts
FROM users
WHERE username LIKE 'test%'
   OR username LIKE 'multiacc%'
   OR username LIKE 'ratetest%';

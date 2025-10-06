#!/bin/bash

# =====================================================
# 🛡️ ANTI-MULTI-ACCOUNTING SECURITY TEST SCRIPT
# =====================================================
# This script tests all 7 layers of security system
# Run: bash test-security.sh
# =====================================================

BASE_URL="http://localhost:3001/api"
ADMIN_TOKEN=""  # Set this after logging in as admin

echo "🛡️ Starting Security System Tests..."
echo "=================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =====================================================
# TEST 1: Device Fingerprinting (Same Device, Different IPs)
# =====================================================
echo -e "\n${BLUE}TEST 1: Device Fingerprinting${NC}"
echo "Registering 3 accounts with SAME device fingerprint..."

DEVICE_FP="test_device_123abc"

# Register 3 accounts with same device fingerprint
for i in {1..3}; do
  echo -e "${YELLOW}Registering test_clone_$i...${NC}"
  curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 192.168.1.$i" \
    -d "{
      \"username\": \"test_clone_$i\",
      \"password\": \"password123\",
      \"deviceFingerprint\": \"$DEVICE_FP\"
    }" | jq -r '.message // .error // .'
  sleep 1
done

echo -e "${GREEN}✓ Expected: All 3 accounts should share device fingerprint $DEVICE_FP${NC}"

# =====================================================
# TEST 2: Rate Limiting (Registration)
# =====================================================
echo -e "\n${BLUE}TEST 2: Rate Limiting (Registration)${NC}"
echo "Trying to register 10 accounts rapidly from same IP..."

for i in {1..10}; do
  echo -e "${YELLOW}Registration attempt $i/10...${NC}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 10.0.0.100" \
    -d "{
      \"username\": \"rate_test_$i\",
      \"password\": \"password123\"
    }")
  
  if [ "$HTTP_CODE" == "429" ]; then
    echo -e "${GREEN}✓ Rate limit triggered at attempt $i (HTTP 429)${NC}"
    break
  fi
  sleep 0.5
done

# =====================================================
# TEST 3: IP Tracking (Multiple Accounts, Same IP)
# =====================================================
echo -e "\n${BLUE}TEST 3: IP Tracking (Multi-Account Detection)${NC}"
echo "Registering 7 accounts from SAME IP..."

SHARED_IP="203.0.113.50"

for i in {1..7}; do
  echo -e "${YELLOW}Registering multi_acc_$i from $SHARED_IP...${NC}"
  curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $SHARED_IP" \
    -d "{
      \"username\": \"multi_acc_$i\",
      \"password\": \"password123\"
    }" | jq -r '.message // .error // .'
  sleep 1
done

echo -e "${GREEN}✓ Expected: IP $SHARED_IP should have 7 accounts (flagged as suspicious)${NC}"

# =====================================================
# TEST 4: Username Pattern Detection
# =====================================================
echo -e "\n${BLUE}TEST 4: Username Pattern Detection (Clone Detection)${NC}"
echo "Trying to register accounts with clone patterns..."

# These should be BLOCKED
CLONE_PATTERNS=("player_1" "player_2" "account_99" "bot_123")

for username in "${CLONE_PATTERNS[@]}"; do
  echo -e "${YELLOW}Trying to register: $username${NC}"
  RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 192.168.2.100" \
    -d "{
      \"username\": \"$username\",
      \"password\": \"password123\"
    }")
  
  if echo "$RESPONSE" | grep -q "not allowed"; then
    echo -e "${GREEN}✓ Blocked: $username (clone pattern detected)${NC}"
  else
    echo -e "${RED}✗ Failed to block: $username${NC}"
  fi
done

# =====================================================
# TEST 5: Behavioral Analysis - Combat Spamming
# =====================================================
echo -e "\n${BLUE}TEST 5: Behavioral Analysis (Combat Spamming)${NC}"
echo "Login and spam 60 combats to trigger bot detection..."

# First, register a test user
echo -e "${YELLOW}Creating test_bot_user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_bot_user",
    "password": "password123"
  }')

# Login to get token
echo -e "${YELLOW}Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_bot_user",
    "password": "password123"
  }')

BOT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

if [ -n "$BOT_TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  
  # Spam 60 combats
  echo -e "${YELLOW}Starting 60 rapid combats...${NC}"
  for i in {1..60}; do
    if [ $((i % 10)) -eq 0 ]; then
      echo -e "${YELLOW}Combat $i/60...${NC}"
    fi
    
    # Start combat (this will trigger behavioral tracking)
    curl -s -X POST "$BASE_URL/combat-results" \
      -H "Authorization: Bearer $BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "monsterId": 1,
        "victory": true,
        "damageDealt": 100
      }' > /dev/null
    
    sleep 0.05  # Very fast (50ms interval = bot-like)
  done
  
  echo -e "${GREEN}✓ 60 combats completed in rapid succession${NC}"
  echo -e "${GREEN}✓ Expected: User should be flagged with high suspicious score${NC}"
else
  echo -e "${RED}✗ Failed to login test_bot_user${NC}"
fi

# =====================================================
# TEST 6: Behavioral Analysis - Farming Detection
# =====================================================
echo -e "\n${BLUE}TEST 6: Behavioral Analysis (Farming Detection)${NC}"
echo "Spamming 60 explorations to trigger farming detection..."

if [ -n "$BOT_TOKEN" ]; then
  echo -e "${YELLOW}Starting 60 rapid explorations...${NC}"
  for i in {1..60}; do
    if [ $((i % 10)) -eq 0 ]; then
      echo -e "${YELLOW}Exploration $i/60...${NC}"
    fi
    
    # Explore (this will trigger farming tracking)
    curl -s -X POST "$BASE_URL/explore/wildarea/start" \
      -H "Authorization: Bearer $BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{}' > /dev/null
    
    sleep 0.05  # Very fast (50ms interval = bot-like)
  done
  
  echo -e "${GREEN}✓ 60 explorations completed in rapid succession${NC}"
  echo -e "${GREEN}✓ Expected: User should be flagged as farming bot${NC}"
fi

# =====================================================
# TEST 7: Admin Security Dashboard
# =====================================================
echo -e "\n${BLUE}TEST 7: Admin Security Dashboard${NC}"
echo "Checking admin dashboard endpoints..."

# Login as admin first
echo -e "${YELLOW}Logging in as admin...${NC}"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.access_token // empty')

if [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Admin login successful${NC}"
  
  # Check dashboard
  echo -e "\n${YELLOW}Fetching security dashboard...${NC}"
  DASHBOARD=$(curl -s -X GET "$BASE_URL/admin/security/dashboard" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  echo "$DASHBOARD" | jq '.'
  
  # Check IP accounts
  echo -e "\n${YELLOW}Checking IP $SHARED_IP accounts...${NC}"
  IP_ACCOUNTS=$(curl -s -X GET "$BASE_URL/admin/security/ip-accounts?ip=$SHARED_IP" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  echo "$IP_ACCOUNTS" | jq '.'
  
  ACCOUNT_COUNT=$(echo "$IP_ACCOUNTS" | jq -r '.accountCount // 0')
  if [ "$ACCOUNT_COUNT" -ge 5 ]; then
    echo -e "${GREEN}✓ Multi-account detected: $ACCOUNT_COUNT accounts from $SHARED_IP${NC}"
  fi
  
else
  echo -e "${RED}✗ Failed to login as admin${NC}"
  echo -e "${YELLOW}Please update admin credentials in the script${NC}"
fi

# =====================================================
# SUMMARY & VERIFICATION
# =====================================================
echo -e "\n${BLUE}=================================================="
echo "📊 TEST SUMMARY"
echo "==================================================${NC}"

echo -e "\n${YELLOW}To verify results:${NC}"
echo ""
echo "1️⃣ Check Redis keys:"
echo "   docker exec -it redis-container redis-cli"
echo "   KEYS combat_pattern:*"
echo "   KEYS farming:*"
echo "   KEYS suspicious_accounts"
echo ""
echo "2️⃣ Check database:"
echo "   SELECT id, username, isSuspicious, suspiciousScore, deviceFingerprints"
echo "   FROM users"
echo "   WHERE username LIKE 'test_%'"
echo "   ORDER BY suspiciousScore DESC;"
echo ""
echo "3️⃣ Check IP accounts:"
echo "   SELECT registrationIp, COUNT(*) as account_count"
echo "   FROM users"
echo "   WHERE registrationIp = '$SHARED_IP'"
echo "   GROUP BY registrationIp;"
echo ""
echo "4️⃣ View admin dashboard:"
echo "   Open: http://localhost:3000/admin/security"
echo ""

echo -e "${YELLOW}Expected Results:${NC}"
echo "  ✓ test_clone_1/2/3 - Same device fingerprint"
echo "  ✓ Rate limit triggered after 5-10 registrations"
echo "  ✓ $SHARED_IP - 7+ accounts (suspicious)"
echo "  ✓ Clone patterns blocked (player_1, bot_123, etc.)"
echo "  ✓ test_bot_user - High suspicious score (>60)"
echo "  ✓ Admin dashboard shows all suspicious accounts"
echo ""

echo -e "${GREEN}🎉 Security tests completed!${NC}"
echo "Check the verification steps above to confirm results."

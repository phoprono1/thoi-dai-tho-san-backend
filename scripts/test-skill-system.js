// Test script for Skill System
// Run this to verify the skill system is working

const API_BASE = 'http://localhost:3005/api';
let authToken = '';
let userId = '';

const fetchWithTimeout = (url, options = {}, timeout = 10000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

// Test user credentials
const TEST_USER = {
  username: 'testuser',
  password: 'password123'
};

async function login() {
  try {
    console.log('🔐 Logging in test user...');
    const response = await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    authToken = data.access_token;

    // Get user info
    const userResponse = await fetchWithTimeout(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const userData = await userResponse.json();
    if (!userResponse.ok) throw new Error('Failed to get user info');
    userId = userData.id;

    console.log(`✅ Logged in as user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function getPlayerSkills() {
  try {
    console.log('📚 Getting player skills...');
    const response = await fetchWithTimeout(`${API_BASE}/skills`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Get skills failed');
    console.log('✅ Player skills:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Get skills failed:', error.message);
    return null;
  }
}

async function getAvailableSkills() {
  try {
    console.log('🔓 Getting available skills...');
    const response = await fetchWithTimeout(`${API_BASE}/skills/available`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Get available skills failed');
    console.log('✅ Available skills:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Get available skills failed:', error.message);
    return null;
  }
}

async function unlockSkill(skillId) {
  try {
    console.log(`🔓 Unlocking skill: ${skillId}...`);
    const response = await fetchWithTimeout(`${API_BASE}/skills/unlock/${skillId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unlock skill failed');
    console.log('✅ Skill unlocked:', data);
    return data;
  } catch (error) {
    console.error('❌ Unlock skill failed:', error.message);
    return null;
  }
}

async function levelUpSkill(skillId) {
  try {
    console.log(`⬆️ Leveling up skill: ${skillId}...`);
    const response = await fetchWithTimeout(`${API_BASE}/skills/level-up/${skillId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Level up skill failed');
    console.log('✅ Skill leveled up:', data);
    return data;
  } catch (error) {
    console.error('❌ Level up skill failed:', error.message);
    return null;
  }
}

async function getSkillEffects() {
  try {
    console.log('⚡ Getting skill effects...');
    const response = await fetchWithTimeout(`${API_BASE}/skills/effects`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Get effects failed');
    console.log('✅ Skill effects:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Get effects failed:', error.message);
    return null;
  }
}

async function getUserStats() {
  try {
    console.log('📊 Getting user stats...');
    const response = await fetchWithTimeout(`${API_BASE}/user-stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Get stats failed');
    console.log('✅ User stats:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Get stats failed:', error.message);
    return null;
  }
}

async function allocateAttributePoints() {
  try {
    console.log('💪 Allocating attribute points...');

    // Allocate 15 points to strength (one by one)
    for (let i = 0; i < 15; i++) {
      const response = await fetchWithTimeout(`${API_BASE}/user-attributes/allocate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attribute: 'STR'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Allocate point failed');
      }
    }

    console.log('✅ Attribute points allocated: 15 points to STR');
    return { success: true };
  } catch (error) {
    console.error('❌ Allocate points failed:', error.message);
    return null;
  }
}

async function testSkillSystem() {
  console.log('🧪 Testing Skill System\n');

  // Login
  if (!await login()) {
    console.log('❌ Cannot proceed without login. Please ensure test user exists.');
    return;
  }

  // Get initial skills
  await getPlayerSkills();

  // Get user stats to check requirements
  let userStats = await getUserStats();
  if (!userStats || userStats.length === 0) {
    console.log('❌ Cannot get user stats. Please ensure user exists and has stats.');
    return;
  }

  userStats = userStats[0]; // Get first stats entry

  // Check if user meets basic requirements for power_strike (level 1, STR 20)
  const meetsLevelReq = userStats.user.level >= 1;
  const meetsStrReq = (userStats.strength + userStats.strengthPoints) >= 20;
  const hasUnspentPoints = userStats.unspentAttributePoints >= 10;

  console.log(`📊 User level: ${userStats.user.level}, STR: ${userStats.strength + userStats.strengthPoints}, Unspent points: ${userStats.unspentAttributePoints}`);
  console.log(`🎯 Power Strike requirements: Level 1, STR 20`);

  if (!meetsLevelReq || !meetsStrReq) {
    console.log('⚠️ User does not meet skill requirements. Allocating attribute points...');

    if (hasUnspentPoints) {
      await allocateAttributePoints();
      // Refresh stats
      userStats = await getUserStats();
      userStats = userStats[0];
    } else {
      console.log('❌ User has no unspent attribute points. Please level up the user first.');
      return;
    }
  }

  // Get available skills
  const availableSkills = await getAvailableSkills();
  if (!availableSkills || availableSkills.length === 0) {
    console.log('❌ No skills available. User may not meet requirements.');
    return;
  }

  // Try to unlock first available skill
  const firstSkill = availableSkills[0];
  console.log(`🎯 Attempting to unlock: ${firstSkill.id} (${firstSkill.name})`);

  await unlockSkill(firstSkill.id);

  // Get updated skills
  await getPlayerSkills();

  // Try to level up the skill
  await levelUpSkill(firstSkill.id);

  // Get skill effects
  await getSkillEffects();

  console.log('\n✅ Skill system test completed!');
}

// Run test
testSkillSystem().catch(console.error);
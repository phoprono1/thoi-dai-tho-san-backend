const axios = require('axios');

const BASE_URL = 'http://localhost:3005/api';
let authToken = '';

// Test functions
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin', // Replace with your admin username
      password: 'admin123' // Replace with your admin password
    });
    authToken = response.data.access_token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function createBossSchedule() {
  try {
    const sampleData = require('./src/world-boss/sample-boss-schedule.json');
    
    const response = await axios.post(`${BASE_URL}/world-boss/schedule`, sampleData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Boss schedule created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create boss schedule:', error.response?.data || error.message);
    return null;
  }
}

async function getCurrentBoss() {
  try {
    const response = await axios.get(`${BASE_URL}/world-boss/current`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Current boss:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get current boss:', error.response?.data || error.message);
    return null;
  }
}

async function createManualBoss() {
  try {
    const bossData = {
      name: "Test Boss",
      description: "A test boss for manual testing",
      maxHp: 999999999,
      level: 30,
      stats: {
        attack: 3000,
        defense: 2000,
        critRate: 10,
        critDamage: 150
      },
      durationMinutes: 60
    };
    
    const response = await axios.post(`${BASE_URL}/world-boss`, bossData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Manual boss created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create manual boss:', error.response?.data || error.message);
    return null;
  }
}

async function attackBoss() {
  try {
    const response = await axios.post(`${BASE_URL}/world-boss/attack`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Boss attack result:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to attack boss:', error.response?.data || error.message);
    return null;
  }
}

async function getRankings() {
  try {
    const response = await axios.get(`${BASE_URL}/world-boss/rankings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Boss rankings:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get rankings:', error.response?.data || error.message);
    return null;
  }
}

async function getAllSchedules() {
  try {
    const response = await axios.get(`${BASE_URL}/world-boss/schedule`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ All schedules:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get schedules:', error.response?.data || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting World Boss API Tests...\n');
  
  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  console.log('\n📋 Testing Boss Schedule Management...');
  
  // Step 2: Create boss schedule
  await createBossSchedule();
  
  // Step 3: Get all schedules
  await getAllSchedules();
  
  console.log('\n⚔️ Testing Boss Combat...');
  
  // Step 4: Create manual boss for testing
  await createManualBoss();
  
  // Step 5: Get current boss
  await getCurrentBoss();
  
  // Step 6: Attack boss
  await attackBoss();
  
  // Step 7: Get rankings
  await getRankings();
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(console.error);

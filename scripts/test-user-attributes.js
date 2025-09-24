// Test script for User Attributes API endpoints
// Run this to verify the free attribute points system is working

// Using built-in fetch (Node.js 18+)

const API_BASE = 'http://localhost:3005/api';

// Test user credentials (adjust as needed)
const TEST_USER = {
  username: 'testuser2',
  password: 'password123'
};

let authToken = '';
let userId = '';

async function login() {
  try {
    console.log('🔐 Logging in test user...');
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    authToken = data.access_token;

    // Get user info
    const userResponse = await fetch(`${API_BASE}/auth/me`, {
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

async function getUserAttributes() {
  try {
    console.log('📊 Getting user attributes...');
    const response = await fetch(`${API_BASE}/user-attributes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Get attributes failed');
    console.log('✅ User attributes:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Get attributes failed:', error.message);
    return null;
  }
}

async function allocateAttributePoint(attribute, points = 1) {
  try {
    console.log(`⚡ Allocating ${points} point(s) to ${attribute}...`);
    const response = await fetch(`${API_BASE}/user-attributes/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ attribute, points })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Allocation failed');
    console.log('✅ Allocation successful:', data);
    return data;
  } catch (error) {
    console.error('❌ Allocation failed:', error.message);
    return null;
  }
}

async function resetAttributePoints() {
  try {
    console.log('🔄 Resetting attribute points...');
    const response = await fetch(`${API_BASE}/user-attributes/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Reset failed');
    console.log('✅ Reset successful:', data);
    return data;
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    return null;
  }
}

async function addTestPoints(points = 10) {
  try {
    console.log(`🎁 Adding ${points} test attribute points...`);
    const response = await fetch(`${API_BASE}/user-attributes/add-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ points })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Add points failed');
    console.log('✅ Test points added:', data);
    return data;
  } catch (error) {
    console.error('❌ Add points failed:', error.message);
    return null;
  }
}

async function testAttributeSystem() {
  console.log('🧪 Testing Free Attribute Points System\n');

  // Login
  if (!await login()) {
    console.log('❌ Cannot proceed without login. Please ensure test user exists.');
    return;
  }

  // Get initial attributes
  const initialAttrs = await getUserAttributes();
  if (!initialAttrs) return;

  // Add test points
  await addTestPoints(5);

  // Get updated attributes after adding points
  const attrsWithPoints = await getUserAttributes();
  if (!attrsWithPoints) return;

  // Allocate some points
  await allocateAttributePoint('STR', 2);
  await allocateAttributePoint('INT', 1);
  await allocateAttributePoint('DEX', 1);

  // Get updated attributes
  const updatedAttrs = await getUserAttributes();
  if (!updatedAttrs) return;

  // Reset points
  await resetAttributePoints();

  // Get final attributes
  const finalAttrs = await getUserAttributes();
  if (!finalAttrs) return;

  // Summary
  console.log('\n📈 Test Summary:');
  console.log(`Initial unspent points: ${initialAttrs.unspentAttributePoints}`);
  console.log(`After adding points: ${attrsWithPoints.unspentAttributePoints}`);
  console.log(`After allocation: ${updatedAttrs.unspentAttributePoints}`);
  console.log(`After reset: ${finalAttrs.unspentAttributePoints}`);
  console.log(`STR points: ${finalAttrs.allocatedPoints.strength}`);
  console.log(`INT points: ${finalAttrs.allocatedPoints.intelligence}`);
  console.log(`DEX points: ${finalAttrs.allocatedPoints.dexterity}`);

  console.log('\n✅ Attribute system test completed!');
}

// Run test
testAttributeSystem().catch(console.error);
// API Test script để kiểm tra endpoint xóa skill
// Run: node test-delete-skill-api.js

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api'; // Cập nhật theo port backend của bạn

// Test configuration
const TEST_CONFIG = {
  // Thay đổi token này thành admin token thực của bạn
  adminToken: 'your_admin_token_here',
  
  // Skill để test (sẽ được tạo và xóa)
  testSkillData: {
    skillId: 'test_deletion_skill',
    name: 'Test Deletion Skill',
    description: 'Skill này chỉ để test việc xóa',
    maxLevel: 3,
    requiredAttribute: 'STR',
    requiredAttributeValue: 10,
    requiredLevel: 5,
    skillPointCost: 1,
    effects: {
      1: { statBonuses: { attack: 5 } },
      2: { statBonuses: { attack: 10 } },
      3: { statBonuses: { attack: 15 } }
    },
    isActive: true,
    sortOrder: 999,
    category: 'Combat',
    skillType: 'passive'
  }
};

// API client với authentication
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${TEST_CONFIG.adminToken}`,
    'Content-Type': 'application/json'
  }
});

async function testSkillDeletionAPI() {
  try {
    console.log('🧪 Testing Skill Deletion API...\n');
    
    // Step 1: Create a test skill
    console.log('1️⃣ Creating test skill...');
    const createResponse = await apiClient.post('/admin/skill-definitions', TEST_CONFIG.testSkillData);
    
    if (createResponse.data.success) {
      console.log('✅ Test skill created successfully');
      console.log(`   Skill ID: ${createResponse.data.data.id}`);
    } else {
      console.log('❌ Failed to create test skill:', createResponse.data.message);
      return;
    }
    
    const createdSkillId = createResponse.data.data.id;
    
    // Step 2: Verify skill exists
    console.log('\n2️⃣ Verifying skill exists...');
    const getResponse = await apiClient.get(`/admin/skill-definitions/${createdSkillId}`);
    
    if (getResponse.data) {
      console.log('✅ Test skill found in database');
      console.log(`   Name: ${getResponse.data.name}`);
      console.log(`   Active: ${getResponse.data.isActive}`);
    } else {
      console.log('❌ Test skill not found');
      return;
    }
    
    // Step 3: Optional - Add skill to a player (if you have test user data)
    console.log('\n3️⃣ (Optional) Add skill to player - skipped for safety');
    
    // Step 4: Delete the skill
    console.log('\n4️⃣ Deleting test skill...');
    const deleteResponse = await apiClient.delete(`/admin/skill-definitions/${createdSkillId}`);
    
    if (deleteResponse.data.success) {
      console.log('✅ Test skill deleted successfully');
      console.log(`   Message: ${deleteResponse.data.message}`);
    } else {
      console.log('❌ Failed to delete test skill:', deleteResponse.data.message);
    }
    
    // Step 5: Verify skill is soft deleted (isActive = false)
    console.log('\n5️⃣ Verifying skill is soft deleted...');
    try {
      const verifyResponse = await apiClient.get(`/admin/skill-definitions/${createdSkillId}`);
      
      if (verifyResponse.data && !verifyResponse.data.isActive) {
        console.log('✅ Skill is properly soft deleted (isActive = false)');
      } else if (verifyResponse.data && verifyResponse.data.isActive) {
        console.log('❌ Skill still active - deletion failed');
      } else {
        console.log('⚠️ Skill not found - might be hard deleted');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Skill not found - might be hard deleted or filtered out');
      } else {
        console.log('❌ Error verifying deletion:', error.message);
      }
    }
    
    console.log('\n✨ API Test completed!');
    console.log('\n📝 Notes:');
    console.log('   - Make sure to update adminToken in TEST_CONFIG');
    console.log('   - Check backend logs for skill deletion details');
    console.log('   - Verify in database that player_skills were also removed');
    
  } catch (error) {
    console.error('❌ API Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Tip: Make sure adminToken is valid and user has admin role');
    }
  }
}

// Validate configuration
if (TEST_CONFIG.adminToken === 'your_admin_token_here') {
  console.log('⚠️ Please update adminToken in TEST_CONFIG before running this test');
  process.exit(1);
}

// Run the test
testSkillDeletionAPI().catch(console.error);
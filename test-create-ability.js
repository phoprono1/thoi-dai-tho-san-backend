const axios = require('axios');

const testData = {
  name: 'Test Fireball',
  type: 'attack',
  description: 'A powerful fire attack',
  targetType: 'enemy',
  cooldown: 3,
  manaCost: 20,
  effects: {
    scaling: {
      intelligence: 1.5,
    },
    damageMultiplier: 1.2,
    damageType: 'magic',
  },
  isActive: true,
};

async function testCreateAbility() {
  try {
    console.log('Sending request with data:');
    console.log(JSON.stringify(testData, null, 2));
    
    const response = await axios.post('http://localhost:3005/api/admin/pet-abilities', testData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('\n✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\n❌ Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testCreateAbility();

const axios = require('axios');

async function checkEvolutions() {
  try {
    // Get evolutions for petId 2 (rồng nước)
    const response = await axios.get('http://localhost:3005/api/admin/pets/rong_nuoc/evolutions');
    
    console.log('✅ Evolution data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.length > 0) {
      const firstEvolution = response.data[0];
      console.log('\n📊 StatMultipliers format:');
      console.log(JSON.stringify(firstEvolution.statMultipliers, null, 2));
      
      // Check if it has new format
      const hasNewFormat = firstEvolution.statMultipliers.strength !== undefined;
      console.log(`\n${hasNewFormat ? '✅' : '❌'} Using new core stats format:`, hasNewFormat);
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkEvolutions();

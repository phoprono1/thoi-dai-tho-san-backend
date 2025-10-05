/**
 * Test script for Pet Equipment API
 * Run: node test-pet-equipment.js
 */

const http = require('http');

// Test configuration
const config = {
  host: 'localhost',
  port: 3005,
  // Add your auth token here
  authToken: 'YOUR_AUTH_TOKEN_HERE',
};

// Test 1: Get user pets
async function testGetUserPets() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/api/pets/my-pets?includeInactive=true',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.authToken}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ GET /api/pets/my-pets - Status:', res.statusCode);
          console.log('Response:', JSON.stringify(result, null, 2));
          
          if (res.statusCode === 200) {
            console.log('\n📊 Pets found:', result.length);
            if (result.length > 0) {
              console.log('\n🐾 First pet:');
              console.log('  ID:', result[0].id);
              console.log('  Name:', result[0].name);
              console.log('  Level:', result[0].level);
              console.log('  Equipment:', result[0].equipment || []);
            }
          }
          
          resolve(result);
        } catch (error) {
          console.error('❌ Parse error:', error.message);
          console.error('Raw data:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('🚀 Testing Pet Equipment API...\n');
  
  try {
    await testGetUserPets();
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Check if auth token is set
if (config.authToken === 'YOUR_AUTH_TOKEN_HERE') {
  console.log('⚠️  Please set your auth token in config.authToken');
  console.log('You can get it from browser DevTools > Application > Cookies > auth_token');
  process.exit(1);
}

runTests();

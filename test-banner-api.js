const API_BASE = 'http://localhost:3005/api';

// You need to get a valid JWT token first
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlNpa2VTIiwic3ViIjo0LCJpYXQiOjE3NTk1NTM2NTgsImV4cCI6MTc2MDE1ODQ1OH0.DUfA4_zcK8oqIi3E4OStMVOL8Cc_IwkNuZTFufXpvo4';

async function testBannerAPIs() {
  try {
    console.log('🧪 Testing Pet Banner APIs\n');

    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

    // Test 1: Get active banners
    console.log('1️⃣ Testing GET /pets/banners/active');
    try {
      const response1 = await fetch(`${API_BASE}/pets/banners/active`, { headers });
      const data1 = await response1.json();
      if (response1.ok) {
        console.log('✅ Success:', data1);
      } else {
        console.log('❌ Error:', response1.status, data1);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    console.log('\n2️⃣ Testing GET /pets/banners/1');
    try {
      const response2 = await fetch(`${API_BASE}/pets/banners/1`, { headers });
      const data2 = await response2.json();
      if (response2.ok) {
        console.log('✅ Success:', data2);
      } else {
        console.log('❌ Error:', response2.status, data2);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    console.log('\n3️⃣ Testing GET /pets/banners/1/featured-pets');
    try {
      const response3 = await fetch(`${API_BASE}/pets/banners/1/featured-pets`, { headers });
      const data3 = await response3.json();
      if (response3.ok) {
        console.log('✅ Success:', data3);
      } else {
        console.log('❌ Error:', response3.status, data3);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    console.log('\n4️⃣ Testing GET /pets/pull-history?limit=20');
    try {
      const response4 = await fetch(`${API_BASE}/pets/pull-history?limit=20`, { headers });
      const data4 = await response4.json();
      if (response4.ok) {
        console.log('✅ Success:', data4);
      } else {
        console.log('❌ Error:', response4.status, data4);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

console.log('Usage: node test-banner-api.js <JWT_TOKEN>');
console.log('You can get the token from the browser\'s localStorage.getItem("token")\n');

testBannerAPIs();

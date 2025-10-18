// Test script for scratch cards API
const axios = require('axios');

async function testScratchCardsAPI() {
  const baseURL = 'http://localhost:3005/api';

  try {
    console.log('Testing scratch cards API...');

    // First, try without auth to see if endpoint exists
    try {
      const response = await axios.get(`${baseURL}/casino/scratch-cards/types`);
      console.log('Response without auth:', response.status);
    } catch (error) {
      console.log('Expected error without auth:', error.response?.status, error.response?.data);
    }

    // Try with invalid token
    try {
      const response = await axios.get(`${baseURL}/casino/scratch-cards/types`, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlNpa2VTIiwic3ViIjo0LCJpYXQiOjE3NjA2NjYxNjIsImV4cCI6MTc2MTI3MDk2Mn0.BFS3fKlquAXl2h3uuKenPUrkaAg7OVJbIfuJ8K5zrgk',
        }
      });
      console.log('Response with invalid token:', response.status);
    } catch (error) {
      console.log('Expected error with invalid token:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testScratchCardsAPI();
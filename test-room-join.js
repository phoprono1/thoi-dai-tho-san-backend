const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testRoomJoin() {
  try {
    console.log('=== Testing Room Join Functionality ===');
    
    // 1. Lấy danh sách users
    console.log('\n1. Getting users...');
    const usersResponse = await axios.get(`${BASE_URL}/users`);
    console.log(`Found ${usersResponse.data.length} users`);
    if (usersResponse.data.length > 0) {
      console.log('First user:', usersResponse.data[0]);
    }
    
    // 2. Lấy danh sách dungeons
    console.log('\n2. Getting dungeons...');
    const dungeonsResponse = await axios.get(`${BASE_URL}/dungeons`);
    console.log(`Found ${dungeonsResponse.data.length} dungeons`);
    if (dungeonsResponse.data.length > 0) {
      console.log('First dungeon:', dungeonsResponse.data[0]);
    }
    
    // 3. Lấy danh sách phòng hiện tại
    console.log('\n3. Getting current rooms...');
    const roomsResponse = await axios.get(`${BASE_URL}/room-lobby`);
    console.log(`Found ${roomsResponse.data.length} rooms`);
    if (roomsResponse.data.length > 0) {
      console.log('Rooms:', roomsResponse.data);
    }
    
    // 4. Tạo phòng nếu có user và dungeon
    if (usersResponse.data.length > 0 && dungeonsResponse.data.length > 0) {
      const user = usersResponse.data[0];
      const dungeon = dungeonsResponse.data[0];
      
      console.log('\n4. Creating room...');
      const createRoomResponse = await axios.post(`${BASE_URL}/room-lobby/create`, {
        hostId: user.id,
        dungeonId: dungeon.id,
        name: `Test Room ${Date.now()}`,
        isPrivate: false,
        minPlayers: 1,
        maxPlayers: 4
      });
      
      console.log('Room created:', createRoomResponse.data);
      const roomId = createRoomResponse.data.id;
      
      // 5. Test join room
      console.log('\n5. Testing join room...');
      if (usersResponse.data.length > 1) {
        const joiner = usersResponse.data[1];
        try {
          const joinResponse = await axios.post(`${BASE_URL}/room-lobby/${roomId}/join`, {
            playerId: joiner.id
          });
          console.log('Join successful:', joinResponse.data);
        } catch (error) {
          console.log('Join failed:', error.response?.data || error.message);
        }
      } else {
        console.log('Not enough users to test join (need at least 2)');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testRoomJoin();

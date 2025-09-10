# Chat System Documentation

## Tổng quan
Hệ thống chat hỗ trợ 2 loại chat:
- **Chat thế giới**: Tất cả người chơi có thể tham gia
- **Chat công hội**: Chỉ thành viên trong cùng công hội

## Kiến trúc
- **Backend**: NestJS với WebSocket (Socket.IO)
- **Database**: PostgreSQL với entity `chat_messages`
- **Real-time**: WebSocket cho instant messaging

## API Endpoints

### REST API
```
POST   /chat/send              - Gửi tin nhắn
GET    /chat/world             - Lấy tin nhắn thế giới
GET    /chat/guild/:guildId    - Lấy tin nhắn công hội
DELETE /chat/message/:messageId - Xóa tin nhắn
```

### WebSocket Events

#### Client → Server
```javascript
// Gửi tin nhắn
socket.emit('sendMessage', {
  message: "Hello world!",
  type: "world", // hoặc "guild"
  guildId: 123 // chỉ cần khi type = "guild"
});

// Tham gia chat công hội
socket.emit('joinGuild', { guildId: 123 });

// Rời chat công hội
socket.emit('leaveGuild', { guildId: 123 });

// Lấy tin nhắn thế giới
socket.emit('getWorldMessages');

// Lấy tin nhắn công hội
socket.emit('getGuildMessages', { guildId: 123 });
```

#### Server → Client
```javascript
// Nhận tin nhắn mới
socket.on('newMessage', (message) => {
  // Handle new message
});

// Xác nhận gửi tin nhắn thành công
socket.on('messageSent', (message) => {
  // Handle message sent confirmation
});

// Nhận tin nhắn thế giới
socket.on('worldMessages', (messages) => {
  // Handle world messages
});

// Nhận tin nhắn công hội
socket.on('guildMessages', (data) => {
  // Handle guild messages
});

// Lỗi
socket.on('error', (error) => {
  // Handle error
});
```

## Database Schema

```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES "user"(id),
  message TEXT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('world', 'guild')),
  guildId INTEGER NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  isDeleted BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_userId ON chat_messages(userId);
CREATE INDEX idx_chat_messages_type ON chat_messages(type);
CREATE INDEX idx_chat_messages_guildId ON chat_messages(guildId);
CREATE INDEX idx_chat_messages_createdAt ON chat_messages(createdAt);
```

## Cách sử dụng

### 1. Kết nối WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  query: { userId: 123 } // Thay bằng user ID thực tế
});
```

### 2. Gửi tin nhắn thế giới
```javascript
socket.emit('sendMessage', {
  message: "Xin chào mọi người!",
  type: "world"
});
```

### 3. Gửi tin nhắn công hội
```javascript
socket.emit('sendMessage', {
  message: "Hello guild members!",
  type: "guild",
  guildId: 456
});
```

### 4. Lắng nghe tin nhắn mới
```javascript
socket.on('newMessage', (message) => {
  // message = {
  //   id: 1,
  //   userId: 123,
  //   username: "player1",
  //   message: "Hello!",
  //   type: "world",
  //   createdAt: "2025-09-07T10:00:00Z"
  // }
  displayMessage(message);
});
```

## Validation Rules
- Tin nhắn: 1-500 ký tự
- Type: chỉ chấp nhận "world" hoặc "guild"
- Guild chat: phải cung cấp guildId hợp lệ
- User phải tồn tại trong hệ thống

## Security
- JWT authentication cho REST API
- User authentication cho WebSocket
- Rate limiting (có thể implement thêm)
- Message filtering (có thể implement thêm)

## TODO
- [ ] Implement JWT authentication cho WebSocket
- [ ] Thêm rate limiting
- [ ] Thêm message filtering
- [ ] Thêm emoji support
- [ ] Thêm file/image sharing
- [ ] Thêm message reactions

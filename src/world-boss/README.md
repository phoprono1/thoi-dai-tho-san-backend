# World Boss System Documentation

## Tổng quan
Hệ thống World Boss cho phép nhiều người chơi cùng nhau đánh bại boss thế giới với:
- **Damage Calculation**: Dựa trên % HP của người chơi (tránh lag)
- **Real-time Combat**: WebSocket updates
- **Ranking System**: Bảng xếp hạng damage cá nhân và công hội
- **Reward Distribution**: Phân phát quà qua hòm thư
- **Respawn System**: Boss tự động respawn sau 30 giây

## Kiến trúc
- **Backend**: NestJS với TypeORM
- **Database**: PostgreSQL với các bảng world_boss, boss_combat_log, boss_damage_ranking
- **Real-time**: WebSocket cho updates tức thời
- **Rewards**: Tích hợp với Mailbox system

## Database Schema

### world_boss
```sql
CREATE TABLE world_boss (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  maxHp INTEGER NOT NULL,
  currentHp INTEGER DEFAULT 0,
  level INTEGER NOT NULL,
  stats JSONB NOT NULL,
  status ENUM('alive', 'dead', 'respawning') DEFAULT 'alive',
  respawnTime TIMESTAMP NULL,
  respawnDuration INTEGER DEFAULT 30,
  rewards JSONB NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### boss_combat_log
```sql
CREATE TABLE boss_combat_log (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES "user"(id),
  bossId INTEGER REFERENCES world_boss(id),
  action ENUM('attack', 'defend', 'crit', 'miss'),
  damage INTEGER NOT NULL,
  bossHpBefore INTEGER NOT NULL,
  bossHpAfter INTEGER NOT NULL,
  playerStats JSONB,
  bossStats JSONB,
  actionOrder INTEGER DEFAULT 0,
  turn INTEGER DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### boss_damage_ranking
```sql
CREATE TABLE boss_damage_ranking (
  id SERIAL PRIMARY KEY,
  bossId INTEGER REFERENCES world_boss(id),
  userId INTEGER REFERENCES "user"(id),
  guildId INTEGER NULL,
  rankingType ENUM('individual', 'guild') DEFAULT 'individual',
  totalDamage BIGINT DEFAULT 0,
  attackCount INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  lastDamage BIGINT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bossId, userId, rankingType)
);
```

## API Endpoints

### REST API
```
POST   /world-boss              - Tạo boss mới (admin)
GET    /world-boss/current      - Lấy thông tin boss hiện tại
POST   /world-boss/attack        - Tấn công boss
GET    /world-boss/rankings/:bossId - Lấy bảng xếp hạng
GET    /world-boss/rankings     - Lấy bảng xếp hạng boss hiện tại
```

### WebSocket Events (sẽ implement sau)
```javascript
// Client events
socket.emit('attackBoss', { damage: 1000 });
socket.emit('getBossInfo');
socket.emit('getRankings');

// Server events
socket.on('bossUpdate', (bossData) => { /* boss HP changed */ });
socket.on('bossDefeated', (data) => { /* boss died, rewards */ });
socket.on('rankingUpdate', (rankings) => { /* rankings changed */ });
```

## Game Mechanics

### Damage Calculation
```javascript
const hpPercentage = (player.currentHp / player.maxHp) * 100;
const actualDamage = Math.floor(inputDamage * (hpPercentage / 100));
const finalDamage = Math.min(actualDamage, boss.currentHp);
```

### Combat Actions
- **ATTACK**: Tấn công thường (80% chance)
- **CRIT**: Tấn công chí mạng (15% chance)
- **MISS**: Né tránh (5% chance)

### Respawn Logic
```javascript
if (bossHp <= 0) {
  boss.status = 'dead';
  boss.currentHp = 0;
  nextRespawnTime = new Date(Date.now() + boss.respawnDuration * 1000);
  boss.respawnTime = nextRespawnTime;
  // Distribute rewards
  // Reset rankings for next boss
}
```

## Reward System

### Individual Rewards (Top 10)
```javascript
const multipliers = [5, 3, 2, 1.5, 1.2, 1, 0.8, 0.6, 0.4, 0.2];
const multiplier = multipliers[rank - 1] || 0.1;

rewards = {
  gold: Math.floor(baseGold * multiplier),
  experience: Math.floor(baseExp * multiplier),
  items: [] // Có thể thêm items theo rank
};
```

### Guild Rewards (Top 5)
- Tương tự individual nhưng dựa trên tổng damage của guild
- Guild nhận bonus rewards nếu có nhiều members tham gia

## Usage Examples

### 1. Tạo Boss mới
```bash
curl -X POST http://localhost:3000/world-boss \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ancient Dragon",
    "description": "A mighty dragon guarding ancient treasures",
    "maxHp": 1000000,
    "level": 50,
    "stats": {
      "attack": 5000,
      "defense": 3000,
      "critRate": 15,
      "critDamage": 200
    },
    "rewards": {
      "gold": 10000,
      "experience": 5000,
      "items": [
        {"itemId": 1, "quantity": 1, "dropRate": 0.1},
        {"itemId": 2, "quantity": 5, "dropRate": 0.5}
      ]
    }
  }'
```

### 2. Lấy thông tin Boss hiện tại
```bash
curl http://localhost:3000/world-boss/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Tấn công Boss
```bash
curl -X POST http://localhost:3000/world-boss/attack \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"damage": 1500}'
```

### 4. Xem bảng xếp hạng
```bash
curl http://localhost:3000/world-boss/rankings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## TODO
- [ ] Implement WebSocket gateway cho real-time updates
- [ ] Add boss respawn scheduler
- [ ] Implement guild damage aggregation
- [ ] Add boss phases với different mechanics
- [ ] Add special events và time-limited bosses
- [ ] Implement boss AI với counter attacks
- [ ] Add boss battle statistics và analytics

## Performance Considerations
- **Damage Calculation**: Dựa trên HP % để tránh spam damage
- **Database Optimization**: Indexes trên userId, bossId, createdAt
- **Caching**: Cache boss info và rankings
- **Rate Limiting**: Giới hạn attack frequency
- **Batch Updates**: Update rankings theo batch

## Security
- JWT authentication cho tất cả endpoints
- Input validation với class-validator
- Rate limiting để tránh spam attacks
- Transaction handling cho data consistency
- Soft delete cho combat logs

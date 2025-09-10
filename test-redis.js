// test-redis.js (CommonJS)
const Redis = require('ioredis');

const url = process.env.REDIS_URL;
console.log('Using REDIS_URL:', url || '(not set)');

if (!url) {
  console.error('ERROR: REDIS_URL is not set. Set it with: $env:REDIS_URL="rediss://..."');
  process.exit(1);
}

const redis = new Redis(url, { maxRetriesPerRequest: 5 });

redis.on('error', (err) => {
  console.error('Redis connection error:', err && err.message ? err.message : err);
});

(async () => {
  try {
    const pong = await redis.ping();
    console.log('PING ->', pong);
    await redis.set('test:key', 'hello', 'EX', 30);
    console.log('GET ->', await redis.get('test:key'));
    await redis.quit();
  } catch (e) {
    console.error('Test failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
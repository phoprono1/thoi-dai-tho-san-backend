// Simple seedable PRNG (mulberry32)
export function createRng(seedInput?: number | string) {
  let seed = 0;
  if (typeof seedInput === 'number') seed = seedInput >>> 0;
  else if (typeof seedInput === 'string') {
    // simple string hash
    seed = 0;
    for (let i = 0; i < seedInput.length; i++) {
      seed = (seed << 5) - seed + seedInput.charCodeAt(i);
      seed |= 0;
    }
    seed = seed >>> 0;
  } else {
    seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  let t = seed + 0x6d2b79f5;
  return {
    next() {
      t |= 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const res = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return res;
    },
    seed,
  };
}

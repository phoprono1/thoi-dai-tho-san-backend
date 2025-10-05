-- Monster Rebalancing Script
-- This script adjusts monster stats to provide appropriate challenge after combat formula changes
-- 
-- Changes made to combat system:
-- 1. Defense formula changed from linear (attack - defense) to percentage-based (attack * (1 - def/(def+100)))
-- 2. Stat coefficients adjusted (INT↓, DEX↑, armorPen↑, combo↓)
-- 3. Accuracy now has base 85%
-- 4. Counter and lifesteal fixed
--
-- Target balance:
-- - Easy enemies: 5-7 turns, player loses ~10-15% HP
-- - Normal enemies: 8-12 turns, player loses ~30-45% HP  
-- - Hard enemies: 15-20 turns, player loses ~60-70% HP
-- - Boss enemies: 25-35 turns, risk of death

-- For reference, a typical level 30 player has:
-- Attack: ~250, Defense: ~95, HP: ~2200

-- ============================================
-- TIER 1: Easy/Normal Monsters (Level 1-15)
-- ============================================
-- These should be early game enemies
-- Target: attack=60-100, defense=10-20, hp=400-800

UPDATE monsters
SET 
  baseAttack = GREATEST(60, FLOOR(baseAttack * 2.0)),
  baseDefense = LEAST(20, FLOOR(baseDefense * 1.5)),
  baseHp = GREATEST(400, FLOOR(baseHp * 3.0))
WHERE level BETWEEN 1 AND 15
  AND type = 'normal';

-- ============================================
-- TIER 2: Mid-Level Monsters (Level 16-30)
-- ============================================
-- These should challenge mid-game players
-- Target: attack=100-180, defense=20-40, hp=800-1500

UPDATE monsters
SET 
  baseAttack = GREATEST(100, FLOOR(baseAttack * 2.5)),
  baseDefense = LEAST(40, FLOOR(baseDefense * 2.0)),
  baseHp = GREATEST(800, FLOOR(baseHp * 4.0))
WHERE level BETWEEN 16 AND 30
  AND type = 'normal';

-- ============================================
-- TIER 3: High-Level Monsters (Level 31-45)
-- ============================================
-- These should be challenging for advanced players
-- Target: attack=180-250, defense=40-60, hp=1500-2500

UPDATE monsters
SET 
  baseAttack = GREATEST(180, FLOOR(baseAttack * 3.0)),
  baseDefense = LEAST(60, FLOOR(baseDefense * 2.5)),
  baseHp = GREATEST(1500, FLOOR(baseHp * 5.0))
WHERE level BETWEEN 31 AND 45
  AND type = 'normal';

-- ============================================
-- TIER 4: End-Game Monsters (Level 46+)
-- ============================================
-- These should be very challenging
-- Target: attack=250-350, defense=60-80, hp=2500-4000

UPDATE monsters
SET 
  baseAttack = GREATEST(250, FLOOR(baseAttack * 3.5)),
  baseDefense = LEAST(80, FLOOR(baseDefense * 3.0)),
  baseHp = GREATEST(2500, FLOOR(baseHp * 6.0))
WHERE level >= 46
  AND type = 'normal';

-- ============================================
-- ELITE MONSTERS (All Levels)
-- ============================================
-- Elite should be 1.3x stronger than normal

UPDATE monsters
SET 
  baseAttack = FLOOR(baseAttack * 1.3),
  baseDefense = FLOOR(baseDefense * 1.3),
  baseHp = FLOOR(baseHp * 1.5)
WHERE type = 'elite';

-- ============================================
-- MINI-BOSS MONSTERS (All Levels)
-- ============================================
-- Mini-bosses should be 1.6x stronger than normal

UPDATE monsters
SET 
  baseAttack = FLOOR(baseAttack * 1.6),
  baseDefense = FLOOR(baseDefense * 1.5),
  baseHp = FLOOR(baseHp * 2.0)
WHERE type = 'mini_boss';

-- ============================================
-- BOSS MONSTERS (All Levels)
-- ============================================
-- Bosses should be 2x stronger than normal with high HP

UPDATE monsters
SET 
  baseAttack = FLOOR(baseAttack * 2.0),
  baseDefense = FLOOR(baseDefense * 1.8),
  baseHp = FLOOR(baseHp * 3.0),
  experienceReward = FLOOR(experienceReward * 2.0),
  goldReward = FLOOR(goldReward * 2.5)
WHERE type = 'boss';

-- ============================================
-- SPECIFIC MONSTER ADJUSTMENTS
-- ============================================
-- Adjust specific monsters if needed
-- Example: If "Chú Cuội" exists and is too weak

-- Uncomment and modify as needed:
-- UPDATE monsters
-- SET 
--   baseAttack = 120,
--   baseDefense = 20,
--   baseHp = 800
-- WHERE name LIKE '%Cuội%' OR name LIKE '%cuoi%';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to check the new values

-- Check distribution by level and type
SELECT 
  type,
  CASE 
    WHEN level BETWEEN 1 AND 15 THEN '1-15 (Easy)'
    WHEN level BETWEEN 16 AND 30 THEN '16-30 (Mid)'
    WHEN level BETWEEN 31 AND 45 THEN '31-45 (Hard)'
    ELSE '46+ (End-game)'
  END as level_range,
  COUNT(*) as count,
  ROUND(AVG(baseAttack)) as avg_attack,
  ROUND(AVG(baseDefense)) as avg_defense,
  ROUND(AVG(baseHp)) as avg_hp
FROM monsters
WHERE isActive = true
GROUP BY type, level_range
ORDER BY level_range, type;

-- Check for any monsters that might be too weak
SELECT id, name, level, type, baseAttack, baseDefense, baseHp
FROM monsters
WHERE baseAttack < 50 OR baseHp < 300
ORDER BY level;

-- Check for any monsters that might be too strong
SELECT id, name, level, type, baseAttack, baseDefense, baseHp
FROM monsters
WHERE baseAttack > 500 OR baseHp > 10000
ORDER BY level DESC;

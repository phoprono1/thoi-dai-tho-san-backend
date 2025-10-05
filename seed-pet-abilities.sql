-- Insert seed data for pet_abilities table
INSERT INTO pet_abilities (name, type, description, effects, cooldown, "manaCost", "targetType", icon, rarity) VALUES
('Bite', 'attack', 'A simple bite attack dealing physical damage', 
 '{"damageType": "physical", "damageMultiplier": 1.0, "scaling": {"strength": 0.5}}'::jsonb, 
 2, 0, 'enemy', '🦷', 1),
 
('Fire Breath', 'attack', 'Breathe fire on enemies dealing magic damage', 
 '{"damageType": "magic", "damageMultiplier": 1.5, "scaling": {"intelligence": 0.8}}'::jsonb, 
 3, 10, 'enemy', '🔥', 3),
 
('Healing Light', 'heal', 'Restore HP to an ally', 
 '{"healAmount": 50, "healPercentage": 0.2}'::jsonb, 
 4, 15, 'ally', '✨', 3),
 
('Battle Cry', 'buff', 'Boost attack power for all allies', 
 '{"statBonus": {"attack": 20}, "duration": 3}'::jsonb, 
 5, 10, 'all_allies', '📢', 3),
 
('Shield Wall', 'buff', 'Increase defense for self', 
 '{"statBonus": {"defense": 30}, "duration": 2}'::jsonb, 
 4, 5, 'self', '🛡️', 2),
 
('Poison Fang', 'attack', 'Bite with poison effect', 
 '{"damageType": "physical", "damageMultiplier": 0.8, "scaling": {"strength": 0.4}, "additionalEffects": [{"type": "poison", "duration": 3, "value": 10}]}'::jsonb, 
 3, 0, 'enemy', '☠️', 2);

-- Verify insertion
SELECT id, name, type, rarity FROM pet_abilities ORDER BY rarity, name;

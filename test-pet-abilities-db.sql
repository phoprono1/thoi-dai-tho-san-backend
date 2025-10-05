-- Test query to verify pet_abilities table exists and has data
SELECT 
    id,
    name,
    type,
    description,
    cooldown,
    targetType as "targetType",
    rarity,
    isActive as "isActive",
    createdAt as "createdAt"
FROM pet_abilities
ORDER BY rarity DESC, name ASC
LIMIT 10;

-- Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pet_abilities'
ORDER BY ordinal_position;

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePetAbilitiesTable1733371200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists
    const tableExists = await queryRunner.hasTable('pet_abilities');

    if (!tableExists) {
      // Create new table
      await queryRunner.createTable(
        new Table({
          name: 'pet_abilities',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'name',
              type: 'varchar',
              length: '100',
              isNullable: false,
            },
            {
              name: 'type',
              type: 'varchar',
              length: '20',
              isNullable: false,
              comment: 'attack, heal, buff, debuff, utility',
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'effects',
              type: 'jsonb',
              isNullable: false,
              comment: 'Ability effect data (damage, scaling, buffs, etc.)',
            },
            {
              name: 'cooldown',
              type: 'int',
              default: 0,
              comment: 'Turns until ability can be used again',
            },
            {
              name: 'manaCost',
              type: 'int',
              default: 0,
              comment: 'Mana cost (future feature)',
            },
            {
              name: 'targetType',
              type: 'varchar',
              length: '20',
              isNullable: false,
              comment: 'enemy, ally, self, all_enemies, all_allies',
            },
            {
              name: 'icon',
              type: 'varchar',
              length: '255',
              isNullable: true,
              comment: 'Icon emoji or image URL',
            },
            {
              name: 'rarity',
              type: 'int',
              default: 1,
              comment: '1-5 star rarity',
            },
            {
              name: 'isActive',
              type: 'boolean',
              default: true,
              comment: 'Can be disabled by admin',
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
        true,
      );

      // Create indexes
      await queryRunner.createIndex(
        'pet_abilities',
        new TableIndex({
          name: 'IDX_pet_abilities_type',
          columnNames: ['type'],
        }),
      );

      await queryRunner.createIndex(
        'pet_abilities',
        new TableIndex({
          name: 'IDX_pet_abilities_rarity',
          columnNames: ['rarity'],
        }),
      );

      await queryRunner.createIndex(
        'pet_abilities',
        new TableIndex({
          name: 'IDX_pet_abilities_isActive',
          columnNames: ['isActive'],
        }),
      );

      // Insert seed data - basic abilities
      await queryRunner.query(`
        INSERT INTO pet_abilities (name, type, description, effects, cooldown, targetType, icon, rarity) VALUES
      
      -- Basic Attack Abilities (1-2 stars)
      ('Bite', 'attack', 'Simple bite attack dealing physical damage', 
       '{"damageType": "physical", "damageMultiplier": 0.8, "scaling": {"strength": 0.5}}'::jsonb,
       2, 'enemy', '🦷', 1),
      
      ('Scratch', 'attack', 'Quick scratch attack',
       '{"damageType": "physical", "damageMultiplier": 0.7, "scaling": {"dexterity": 0.6}}'::jsonb,
       1, 'enemy', '✋', 1),
      
      ('Tackle', 'attack', 'Ram into enemy with full force',
       '{"damageType": "physical", "damageMultiplier": 1.0, "scaling": {"strength": 0.6}}'::jsonb,
       3, 'enemy', '💥', 2),
      
      -- Basic Heal Abilities (1-2 stars)
      ('Lick Wounds', 'heal', 'Heal minor wounds by licking',
       '{"healAmount": 30, "scaling": {"vitality": 0.2}}'::jsonb,
       3, 'ally', '👅', 1),
      
      ('Rest', 'heal', 'Take a moment to rest and recover',
       '{"healAmount": 50, "healPercentage": 0.1}'::jsonb,
       4, 'self', '😴', 1),
      
      -- Advanced Attack Abilities (3 stars)
      ('Fire Breath', 'attack', 'Breathe fire dealing magic damage and burning target',
       '{"damageType": "magic", "damageMultiplier": 1.5, "scaling": {"intelligence": 0.5}, "additionalEffects": [{"type": "burn", "duration": 2, "value": 10}]}'::jsonb,
       3, 'enemy', '🔥', 3),
      
      ('Ice Shard', 'attack', 'Launch ice shards dealing magic damage',
       '{"damageType": "magic", "damageMultiplier": 1.3, "scaling": {"intelligence": 0.6}}'::jsonb,
       3, 'enemy', '❄️', 3),
      
      ('Thunder Strike', 'attack', 'Call down lightning dealing massive damage',
       '{"damageType": "magic", "damageMultiplier": 1.8, "scaling": {"intelligence": 0.7}}'::jsonb,
       4, 'enemy', '⚡', 3),
      
      -- Buff Abilities (3-4 stars)
      ('Battle Cry', 'buff', 'Boost attack of all allies',
       '{"statBonus": {"attack": 20}, "duration": 3}'::jsonb,
       5, 'all_allies', '📢', 3),
      
      ('Defensive Stance', 'buff', 'Increase defense of owner',
       '{"statBonus": {"defense": 30}, "duration": 3}'::jsonb,
       4, 'ally', '🛡️', 3),
      
      ('Lucky Charm', 'buff', 'Increase crit rate temporarily',
       '{"statBonus": {"critRate": 15}, "duration": 2}'::jsonb,
       5, 'ally', '🍀', 4),
      
      -- Heal Abilities (3-4 stars)
      ('Healing Light', 'heal', 'Restore significant HP to owner',
       '{"healAmount": 80, "scaling": {"vitality": 0.4}}'::jsonb,
       4, 'ally', '✨', 3),
      
      ('Group Heal', 'heal', 'Heal all allies',
       '{"healAmount": 50, "scaling": {"vitality": 0.3}}'::jsonb,
       6, 'all_allies', '💚', 4),
      
      -- Legendary Abilities (5 stars)
      ('Dragon Rage', 'attack', 'Unleash devastating dragon attack hitting all enemies',
       '{"damageType": "magic", "damageMultiplier": 2.0, "scaling": {"intelligence": 0.8, "strength": 0.4}, "additionalEffects": [{"type": "burn", "duration": 3, "value": 20}]}'::jsonb,
       6, 'all_enemies', '🐲', 5),
      
      ('Phoenix Revival', 'heal', 'Powerful healing from phoenix flames',
       '{"healAmount": 150, "healPercentage": 0.3, "scaling": {"vitality": 0.5}}'::jsonb,
       7, 'ally', '🔥🦅', 5),
      
      ('Divine Blessing', 'buff', 'Grant powerful buffs to all allies',
       '{"statBonus": {"attack": 30, "defense": 30, "critRate": 10}, "duration": 3}'::jsonb,
       8, 'all_allies', '🌟', 5);
      `);
    } else {
      // Table exists, check if it needs updates
      console.log('pet_abilities table already exists, skipping creation');

      // Check if seed data exists
      const existingAbilities = await queryRunner.query(
        'SELECT COUNT(*) as count FROM pet_abilities',
      );

      if (existingAbilities[0].count === 0) {
        console.log('Inserting seed data for pet abilities');
        await queryRunner.query(`
          INSERT INTO pet_abilities (name, type, description, effects, cooldown, targetType, icon, rarity) VALUES
          ('Bite', 'attack', 'Simple bite attack dealing physical damage', 
           '{"damageType": "physical", "damageMultiplier": 0.8, "scaling": {"strength": 0.5}}'::jsonb,
           2, 'enemy', '🦷', 1),
          ('Fire Breath', 'attack', 'Breathe fire dealing magic damage and burning target',
           '{"damageType": "magic", "damageMultiplier": 1.5, "scaling": {"intelligence": 0.5}, "additionalEffects": [{"type": "burn", "duration": 2, "value": 10}]}'::jsonb,
           3, 'enemy', '🔥', 3),
          ('Healing Light', 'heal', 'Restore significant HP to owner',
           '{"healAmount": 80, "scaling": {"vitality": 0.4}}'::jsonb,
           4, 'ally', '✨', 3),
          ('Battle Cry', 'buff', 'Boost attack of all allies',
           '{"statBonus": {"attack": 20}, "duration": 3}'::jsonb,
           5, 'all_allies', '📢', 3);
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pet_abilities');
  }
}

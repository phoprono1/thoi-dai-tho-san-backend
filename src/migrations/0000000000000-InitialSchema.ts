import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema0000000000000 implements MigrationInterface {
  name = 'InitialSchema0000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types first
    await queryRunner.query(`
      CREATE TYPE "public"."character_classes_type_enum" AS ENUM(
        'warrior', 'mage', 'archer', 'assassin', 'tank', 'healer'
      )
    `);
    
    await queryRunner.query(`
      CREATE TYPE "public"."character_classes_tier_enum" AS ENUM(
        '1', '2', '3', '4'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."classes_tier_enum" AS ENUM(
        'C', 'B', 'A', 'S'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."classes_category_enum" AS ENUM(
        'warrior', 'mage', 'rogue'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."monsters_type_enum" AS ENUM(
        'normal', 'elite', 'boss', 'mini_boss'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."monsters_element_enum" AS ENUM(
        'fire', 'water', 'earth', 'wind', 'light', 'dark', 'neutral'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."quests_type_enum" AS ENUM(
        'main', 'side', 'daily', 'event'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."user_quests_status_enum" AS ENUM(
        'available', 'in_progress', 'completed', 'failed'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."combat_result_type_enum" AS ENUM(
        'victory', 'defeat', 'escape'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."room_lobby_status_enum" AS ENUM(
        'waiting', 'starting', 'in_combat', 'completed', 'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."room_player_status_enum" AS ENUM(
        'invited', 'joined', 'ready', 'left'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."chat_messages_type_enum" AS ENUM(
        'world', 'guild'
      )
    `);

    // Create core tables

    // 1. Guild table (referenced by User)
    await queryRunner.query(`
      CREATE TABLE "guild" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "leaderId" integer,
        "funds" integer NOT NULL DEFAULT '0',
        "level" integer NOT NULL DEFAULT '1',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guild_id" PRIMARY KEY ("id")
      )
    `);

    // 2. Character Classes table (referenced by User)
    await queryRunner.query(`
      CREATE TABLE "character_classes" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text NOT NULL,
        "type" "public"."character_classes_type_enum" NOT NULL,
        "tier" "public"."character_classes_tier_enum" NOT NULL,
        "requiredLevel" integer NOT NULL DEFAULT '1',
        "statBonuses" jsonb NOT NULL,
        "skillTreeData" jsonb NOT NULL DEFAULT '{}',
        "previousClassId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_character_classes_id" PRIMARY KEY ("id")
      )
    `);

    // 3. User table
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" SERIAL NOT NULL,
        "username" character varying NOT NULL,
        "password" character varying NOT NULL,
        "level" integer NOT NULL DEFAULT '1',
        "experience" integer NOT NULL DEFAULT '0',
        "gold" integer NOT NULL DEFAULT '0',
        "characterClassId" integer,
        "guildId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "isBanned" boolean NOT NULL DEFAULT false,
        "isAdmin" boolean NOT NULL DEFAULT false,
        "isDonor" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_user_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_username" UNIQUE ("username")
      )
    `);

    // 4. User Stats table
    await queryRunner.query(`
      CREATE TABLE "user_stat" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "baseHp" integer NOT NULL DEFAULT '100',
        "baseAttack" integer NOT NULL DEFAULT '10',
        "baseDefense" integer NOT NULL DEFAULT '5',
        "critRate" integer NOT NULL DEFAULT '5',
        "critDamage" integer NOT NULL DEFAULT '150',
        "hitRate" integer NOT NULL DEFAULT '80',
        "dodgeRate" integer NOT NULL DEFAULT '5',
        "blockRate" integer NOT NULL DEFAULT '0',
        "blockValue" integer NOT NULL DEFAULT '0',
        "counterRate" integer NOT NULL DEFAULT '0',
        "lifesteal" integer NOT NULL DEFAULT '0',
        "penetration" integer NOT NULL DEFAULT '0',
        "comboRate" integer NOT NULL DEFAULT '0',
        "doubleDropRate" integer NOT NULL DEFAULT '0',
        "expBonus" integer NOT NULL DEFAULT '0',
        "goldBonus" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stat_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stat_userId" UNIQUE ("userId")
      )
    `);

    // 5. Classes table (legacy system)
    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "tier" "public"."classes_tier_enum" NOT NULL DEFAULT 'C',
        "category" "public"."classes_category_enum" NOT NULL,
        "description" text,
        "baseStats" jsonb NOT NULL,
        "requirements" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classes_id" PRIMARY KEY ("id")
      )
    `);

    // 6. User Classes table
    await queryRunner.query(`
      CREATE TABLE "user_classes" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "classId" integer NOT NULL,
        "level" integer NOT NULL DEFAULT '1',
        "experience" integer NOT NULL DEFAULT '0',
        "isActive" boolean NOT NULL DEFAULT false,
        "unlockedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_classes_id" PRIMARY KEY ("id")
      )
    `);

    // 7. Item Sets table
    await queryRunner.query(`
      CREATE TABLE "item_set" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "setBonuses" jsonb NOT NULL DEFAULT '{}',
        "rarity" character varying NOT NULL DEFAULT 'common',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_item_set_id" PRIMARY KEY ("id")
      )
    `);

    // 8. Items table
    await queryRunner.query(`
      CREATE TABLE "item" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "type" character varying NOT NULL,
        "subType" character varying,
        "rarity" character varying NOT NULL DEFAULT 'common',
        "baseStats" jsonb NOT NULL DEFAULT '{}',
        "requirements" jsonb NOT NULL DEFAULT '{}',
        "setId" integer,
        "sellPrice" integer NOT NULL DEFAULT '0',
        "stackable" boolean NOT NULL DEFAULT false,
        "maxStack" integer NOT NULL DEFAULT '1',
        "consumableType" character varying,
        "consumableValue" integer,
        "consumableDuration" integer,
        "classType" character varying,
        "classTier" integer,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_item_id" PRIMARY KEY ("id")
      )
    `);

    // 9. User Items table
    await queryRunner.query(`
      CREATE TABLE "user_item" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "itemId" integer NOT NULL,
        "quantity" integer NOT NULL DEFAULT '1',
        "currentStats" jsonb NOT NULL DEFAULT '{}',
        "upgradeCounts" jsonb NOT NULL DEFAULT '{}',
        "isEquipped" boolean NOT NULL DEFAULT false,
        "obtainedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_item_id" PRIMARY KEY ("id")
      )
    `);

    // 10. User Stamina table
    await queryRunner.query(`
      CREATE TABLE "user_stamina" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "currentStamina" integer NOT NULL DEFAULT '100',
        "maxStamina" integer NOT NULL DEFAULT '100',
        "lastUpdated" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stamina_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stamina_userId" UNIQUE ("userId")
      )
    `);

    // 11. Levels table
    await queryRunner.query(`
      CREATE TABLE "level" (
        "id" SERIAL NOT NULL,
        "level" integer NOT NULL,
        "experienceRequired" integer NOT NULL DEFAULT '100',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_level_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_level_level" UNIQUE ("level")
      )
    `);

    // 12. Dungeons table
    await queryRunner.query(`
      CREATE TABLE "dungeon" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "monsterIds" json NOT NULL DEFAULT '[]',
        "monsterCounts" json NOT NULL DEFAULT '[]',
        "levelRequirement" integer NOT NULL DEFAULT '1',
        "isHidden" boolean NOT NULL DEFAULT false,
        "requiredItem" integer,
        "dropItems" json,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dungeon_id" PRIMARY KEY ("id")
      )
    `);

    // 13. Monsters table
    await queryRunner.query(`
      CREATE TABLE "monsters" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "type" "public"."monsters_type_enum" NOT NULL DEFAULT 'normal',
        "element" "public"."monsters_element_enum" NOT NULL DEFAULT 'neutral',
        "level" integer NOT NULL DEFAULT '1',
        "baseHp" integer NOT NULL DEFAULT '100',
        "baseAttack" integer NOT NULL DEFAULT '10',
        "baseDefense" integer NOT NULL DEFAULT '5',
        "experienceReward" integer NOT NULL DEFAULT '50',
        "goldReward" integer NOT NULL DEFAULT '10',
        "dropItems" json,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_monsters_id" PRIMARY KEY ("id")
      )
    `);

    // 14. Combat Results table
    await queryRunner.query(`
      CREATE TABLE "combat_result" (
        "id" SERIAL NOT NULL,
        "dungeonId" integer NOT NULL,
        "result" "public"."combat_result_type_enum" NOT NULL,
        "experienceGained" integer NOT NULL DEFAULT '0',
        "goldGained" integer NOT NULL DEFAULT '0',
        "itemsObtained" json NOT NULL DEFAULT '[]',
        "participants" json NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_combat_result_id" PRIMARY KEY ("id")
      )
    `);

    // 15. Room Lobby table
    await queryRunner.query(`
      CREATE TABLE "room_lobby" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "hostId" integer NOT NULL,
        "dungeonId" integer NOT NULL,
        "status" "public"."room_lobby_status_enum" NOT NULL DEFAULT 'waiting',
        "minPlayers" integer NOT NULL DEFAULT '1',
        "maxPlayers" integer NOT NULL DEFAULT '4',
        "isPrivate" boolean NOT NULL DEFAULT false,
        "password" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_lobby_id" PRIMARY KEY ("id")
      )
    `);

    // 16. Room Player table
    await queryRunner.query(`
      CREATE TABLE "room_player" (
        "id" SERIAL NOT NULL,
        "roomId" integer NOT NULL,
        "userId" integer NOT NULL,
        "status" "public"."room_player_status_enum" NOT NULL DEFAULT 'invited',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_player_id" PRIMARY KEY ("id")
      )
    `);

    // 17. Quests table
    await queryRunner.query(`
      CREATE TABLE "quests" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "type" "public"."quests_type_enum" NOT NULL DEFAULT 'main',
        "levelRequirement" integer NOT NULL DEFAULT '1',
        "requirements" jsonb NOT NULL DEFAULT '{}',
        "objectives" jsonb NOT NULL DEFAULT '{}',
        "rewards" jsonb NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        "isRepeatable" boolean NOT NULL DEFAULT false,
        "cooldownHours" integer NOT NULL DEFAULT '0',
        "previousQuestId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quests_id" PRIMARY KEY ("id")
      )
    `);

    // 18. User Quests table
    await queryRunner.query(`
      CREATE TABLE "user_quests" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "questId" integer NOT NULL,
        "status" "public"."user_quests_status_enum" NOT NULL DEFAULT 'available',
        "progress" jsonb NOT NULL DEFAULT '{}',
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "lastCooldownAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_quests_id" PRIMARY KEY ("id")
      )
    `);

    // 19. Quest Combat Tracking table
    await queryRunner.query(`
      CREATE TABLE "quest_combat_tracking" (
        "id" SERIAL NOT NULL,
        "userQuestId" integer NOT NULL,
        "combatResultId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quest_combat_tracking_id" PRIMARY KEY ("id")
      )
    `);

    // 20. Chat Messages table
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "message" text NOT NULL,
        "type" "public"."chat_messages_type_enum" NOT NULL DEFAULT 'world',
        "guildId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "isDeleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id")
      )
    `);

    // 21. Character Advancement table
    await queryRunner.query(`
      CREATE TABLE "character_advancement" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "fromClassId" integer NOT NULL,
        "toClassId" integer NOT NULL,
        "advancedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_character_advancement_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_user_quests_userId_status" ON "user_quests" ("userId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_userId" ON "chat_messages" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_type" ON "chat_messages" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_guildId" ON "chat_messages" ("guildId")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_createdAt" ON "chat_messages" ("createdAt")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "character_classes" 
      ADD CONSTRAINT "FK_character_classes_previousClassId" 
      FOREIGN KEY ("previousClassId") REFERENCES "character_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user" 
      ADD CONSTRAINT "FK_user_characterClassId" 
      FOREIGN KEY ("characterClassId") REFERENCES "character_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user" 
      ADD CONSTRAINT "FK_user_guildId" 
      FOREIGN KEY ("guildId") REFERENCES "guild"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "guild" 
      ADD CONSTRAINT "FK_guild_leaderId" 
      FOREIGN KEY ("leaderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_stat" 
      ADD CONSTRAINT "FK_user_stat_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_classes" 
      ADD CONSTRAINT "FK_user_classes_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_classes" 
      ADD CONSTRAINT "FK_user_classes_classId" 
      FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "item" 
      ADD CONSTRAINT "FK_item_setId" 
      FOREIGN KEY ("setId") REFERENCES "item_set"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_item" 
      ADD CONSTRAINT "FK_user_item_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_item" 
      ADD CONSTRAINT "FK_user_item_itemId" 
      FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_stamina" 
      ADD CONSTRAINT "FK_user_stamina_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "combat_result" 
      ADD CONSTRAINT "FK_combat_result_dungeonId" 
      FOREIGN KEY ("dungeonId") REFERENCES "dungeon"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "room_lobby" 
      ADD CONSTRAINT "FK_room_lobby_hostId" 
      FOREIGN KEY ("hostId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "room_lobby" 
      ADD CONSTRAINT "FK_room_lobby_dungeonId" 
      FOREIGN KEY ("dungeonId") REFERENCES "dungeon"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "room_player" 
      ADD CONSTRAINT "FK_room_player_roomId" 
      FOREIGN KEY ("roomId") REFERENCES "room_lobby"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "room_player" 
      ADD CONSTRAINT "FK_room_player_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_quests" 
      ADD CONSTRAINT "FK_user_quests_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_quests" 
      ADD CONSTRAINT "FK_user_quests_questId" 
      FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "quest_combat_tracking" 
      ADD CONSTRAINT "FK_quest_combat_tracking_userQuestId" 
      FOREIGN KEY ("userQuestId") REFERENCES "user_quests"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "quest_combat_tracking" 
      ADD CONSTRAINT "FK_quest_combat_tracking_combatResultId" 
      FOREIGN KEY ("combatResultId") REFERENCES "combat_result"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages" 
      ADD CONSTRAINT "FK_chat_messages_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "character_advancement" 
      ADD CONSTRAINT "FK_character_advancement_userId" 
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "character_advancement" 
      ADD CONSTRAINT "FK_character_advancement_fromClassId" 
      FOREIGN KEY ("fromClassId") REFERENCES "character_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "character_advancement" 
      ADD CONSTRAINT "FK_character_advancement_toClassId" 
      FOREIGN KEY ("toClassId") REFERENCES "character_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(`ALTER TABLE "character_advancement" DROP CONSTRAINT "FK_character_advancement_toClassId"`);
    await queryRunner.query(`ALTER TABLE "character_advancement" DROP CONSTRAINT "FK_character_advancement_fromClassId"`);
    await queryRunner.query(`ALTER TABLE "character_advancement" DROP CONSTRAINT "FK_character_advancement_userId"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_chat_messages_userId"`);
    await queryRunner.query(`ALTER TABLE "quest_combat_tracking" DROP CONSTRAINT "FK_quest_combat_tracking_combatResultId"`);
    await queryRunner.query(`ALTER TABLE "quest_combat_tracking" DROP CONSTRAINT "FK_quest_combat_tracking_userQuestId"`);
    await queryRunner.query(`ALTER TABLE "user_quests" DROP CONSTRAINT "FK_user_quests_questId"`);
    await queryRunner.query(`ALTER TABLE "user_quests" DROP CONSTRAINT "FK_user_quests_userId"`);
    await queryRunner.query(`ALTER TABLE "room_player" DROP CONSTRAINT "FK_room_player_userId"`);
    await queryRunner.query(`ALTER TABLE "room_player" DROP CONSTRAINT "FK_room_player_roomId"`);
    await queryRunner.query(`ALTER TABLE "room_lobby" DROP CONSTRAINT "FK_room_lobby_dungeonId"`);
    await queryRunner.query(`ALTER TABLE "room_lobby" DROP CONSTRAINT "FK_room_lobby_hostId"`);
    await queryRunner.query(`ALTER TABLE "combat_result" DROP CONSTRAINT "FK_combat_result_dungeonId"`);
    await queryRunner.query(`ALTER TABLE "user_stamina" DROP CONSTRAINT "FK_user_stamina_userId"`);
    await queryRunner.query(`ALTER TABLE "user_item" DROP CONSTRAINT "FK_user_item_itemId"`);
    await queryRunner.query(`ALTER TABLE "user_item" DROP CONSTRAINT "FK_user_item_userId"`);
    await queryRunner.query(`ALTER TABLE "item" DROP CONSTRAINT "FK_item_setId"`);
    await queryRunner.query(`ALTER TABLE "user_classes" DROP CONSTRAINT "FK_user_classes_classId"`);
    await queryRunner.query(`ALTER TABLE "user_classes" DROP CONSTRAINT "FK_user_classes_userId"`);
    await queryRunner.query(`ALTER TABLE "user_stat" DROP CONSTRAINT "FK_user_stat_userId"`);
    await queryRunner.query(`ALTER TABLE "guild" DROP CONSTRAINT "FK_guild_leaderId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_user_guildId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_user_characterClassId"`);
    await queryRunner.query(`ALTER TABLE "character_classes" DROP CONSTRAINT "FK_character_classes_previousClassId"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_guildId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_userId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_quests_userId_status"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "character_advancement"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TABLE "quest_combat_tracking"`);
    await queryRunner.query(`DROP TABLE "user_quests"`);
    await queryRunner.query(`DROP TABLE "quests"`);
    await queryRunner.query(`DROP TABLE "room_player"`);
    await queryRunner.query(`DROP TABLE "room_lobby"`);
    await queryRunner.query(`DROP TABLE "combat_result"`);
    await queryRunner.query(`DROP TABLE "monsters"`);
    await queryRunner.query(`DROP TABLE "dungeon"`);
    await queryRunner.query(`DROP TABLE "level"`);
    await queryRunner.query(`DROP TABLE "user_stamina"`);
    await queryRunner.query(`DROP TABLE "user_item"`);
    await queryRunner.query(`DROP TABLE "item"`);
    await queryRunner.query(`DROP TABLE "item_set"`);
    await queryRunner.query(`DROP TABLE "user_classes"`);
    await queryRunner.query(`DROP TABLE "classes"`);
    await queryRunner.query(`DROP TABLE "user_stat"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "character_classes"`);
    await queryRunner.query(`DROP TABLE "guild"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "public"."chat_messages_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."room_player_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."room_lobby_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."combat_result_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_quests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quests_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."monsters_element_enum"`);
    await queryRunner.query(`DROP TYPE "public"."monsters_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."classes_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."classes_tier_enum"`);
    await queryRunner.query(`DROP TYPE "public"."character_classes_tier_enum"`);
    await queryRunner.query(`DROP TYPE "public"."character_classes_type_enum"`);
  }
}
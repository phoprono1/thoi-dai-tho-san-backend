import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1757652874359 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums first (if not already created)
    await queryRunner.query(`
            CREATE TYPE IF NOT EXISTS boss_combat_log_action_enum AS ENUM ('attack', 'defend', 'skill', 'item');
            CREATE TYPE IF NOT EXISTS boss_damage_ranking_rankingtype_enum AS ENUM ('individual', 'guild');
            CREATE TYPE IF NOT EXISTS character_advancements_advancementstatus_enum AS ENUM ('locked', 'unlocked', 'completed');
            CREATE TYPE IF NOT EXISTS character_classes_type_enum AS ENUM ('warrior', 'mage', 'archer', 'healer');
            CREATE TYPE IF NOT EXISTS character_classes_tier_enum AS ENUM ('S', 'A', 'B', 'C');
            CREATE TYPE IF NOT EXISTS chat_messages_type_enum AS ENUM ('world', 'guild', 'private');
            CREATE TYPE IF NOT EXISTS classes_tier_enum AS ENUM ('S', 'A', 'B', 'C');
            CREATE TYPE IF NOT EXISTS classes_category_enum AS ENUM ('offensive', 'defensive', 'support');
            CREATE TYPE IF NOT EXISTS combat_log_action_enum AS ENUM ('attack', 'defend', 'skill', 'item');
            CREATE TYPE IF NOT EXISTS combat_result_result_enum AS ENUM ('victory', 'defeat', 'draw');
            CREATE TYPE IF NOT EXISTS donors_tier_enum AS ENUM ('bronze', 'silver', 'gold', 'platinum');
            CREATE TYPE IF NOT EXISTS donors_status_enum AS ENUM ('active', 'inactive', 'banned');
            CREATE TYPE IF NOT EXISTS guild_events_eventtype_enum AS ENUM ('war', 'raid', 'tournament');
            CREATE TYPE IF NOT EXISTS guild_events_status_enum AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
            CREATE TYPE IF NOT EXISTS guild_members_role_enum AS ENUM ('LEADER', 'OFFICER', 'MEMBER');
            CREATE TYPE IF NOT EXISTS guilds_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'DISBANDED');
            CREATE TYPE IF NOT EXISTS item_consumabletype_enum AS ENUM ('hp', 'mp', 'stamina', 'buff');
            CREATE TYPE IF NOT EXISTS item_type_enum AS ENUM ('weapon', 'armor', 'accessory', 'material', 'consumable');
            CREATE TYPE IF NOT EXISTS mailbox_type_enum AS ENUM ('system', 'guild', 'personal');
            CREATE TYPE IF NOT EXISTS mailbox_status_enum AS ENUM ('unread', 'read', 'claimed');
            CREATE TYPE IF NOT EXISTS monsters_type_enum AS ENUM ('normal', 'elite', 'boss');
            CREATE TYPE IF NOT EXISTS monsters_element_enum AS ENUM ('neutral', 'fire', 'water', 'earth', 'wind');
            CREATE TYPE IF NOT EXISTS pvp_matches_matchtype_enum AS ENUM ('ONE_VS_ONE', 'TEAM_VS_TEAM');
            CREATE TYPE IF NOT EXISTS pvp_matches_status_enum AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
            CREATE TYPE IF NOT EXISTS pvp_players_team_enum AS ENUM ('A', 'B');
            CREATE TYPE IF NOT EXISTS quests_type_enum AS ENUM ('main', 'side', 'daily', 'event');
            CREATE TYPE IF NOT EXISTS room_lobby_status_enum AS ENUM ('waiting', 'ready', 'in_progress', 'completed');
            CREATE TYPE IF NOT EXISTS room_player_status_enum AS ENUM ('joined', 'ready', 'left');
            CREATE TYPE IF NOT EXISTS upgrade_log_result_enum AS ENUM ('success', 'failure');
            CREATE TYPE IF NOT EXISTS user_quests_status_enum AS ENUM ('available', 'in_progress', 'completed', 'failed');
        `);

    // Create tables
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS public.boss_combat_log (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "bossId" integer NOT NULL,
                action boss_combat_log_action_enum NOT NULL,
                damage integer NOT NULL,
                "bossHpBefore" integer NOT NULL,
                "bossHpAfter" integer NOT NULL,
                "playerStats" jsonb NOT NULL,
                "bossStats" jsonb NOT NULL,
                "actionOrder" integer NOT NULL DEFAULT 0,
                turn integer NOT NULL DEFAULT 1,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_01c953801c6631222b8c36a6b9e" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.boss_damage_ranking (
                id serial NOT NULL,
                "bossId" integer NOT NULL,
                "userId" integer NOT NULL,
                "guildId" integer,
                "rankingType" boss_damage_ranking_rankingtype_enum NOT NULL DEFAULT 'individual'::boss_damage_ranking_rankingtype_enum,
                "totalDamage" bigint NOT NULL DEFAULT '0'::bigint,
                "attackCount" integer NOT NULL DEFAULT 0,
                rank integer NOT NULL DEFAULT 0,
                "lastDamage" bigint NOT NULL DEFAULT '0'::bigint,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_b72acd8198f023cf1647edc913e" PRIMARY KEY (id),
                CONSTRAINT "UQ_98dc82308a5a6cc19b33c74cb34" UNIQUE ("bossId", "userId", "rankingType")
            );

            CREATE TABLE IF NOT EXISTS public.character_advancements (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "currentClassId" integer NOT NULL,
                "advancementStatus" character_advancements_advancementstatus_enum NOT NULL DEFAULT 'locked'::character_advancements_advancementstatus_enum,
                "completedRequirements" jsonb,
                "advancementDate" timestamp without time zone,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_23b09b1bdf033c4b6028441a45c" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.character_classes (
                id serial NOT NULL,
                name character varying(100) COLLATE pg_catalog."default" NOT NULL,
                description text COLLATE pg_catalog."default" NOT NULL,
                type character_classes_type_enum NOT NULL,
                tier character_classes_tier_enum NOT NULL,
                "requiredLevel" integer NOT NULL DEFAULT 1,
                "statBonuses" jsonb NOT NULL,
                "skillUnlocks" jsonb NOT NULL,
                "advancementRequirements" jsonb,
                "previousClassId" integer,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_d2a4801e17397302055ed80126c" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.chat_messages (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                message text COLLATE pg_catalog."default" NOT NULL,
                type chat_messages_type_enum NOT NULL DEFAULT 'world'::chat_messages_type_enum,
                "guildId" integer,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "isDeleted" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.classes (
                id serial NOT NULL,
                name character varying(100) COLLATE pg_catalog."default" NOT NULL,
                tier classes_tier_enum NOT NULL DEFAULT 'C'::classes_tier_enum,
                category classes_category_enum NOT NULL,
                description text COLLATE pg_catalog."default",
                "baseStats" jsonb NOT NULL,
                requirements jsonb,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_e207aa15404e9b2ce35910f9f7f" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.combat_log (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                action combat_log_action_enum NOT NULL,
                details json NOT NULL,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "combatResultId" integer,
                "actionOrder" integer NOT NULL DEFAULT 1,
                turn integer NOT NULL DEFAULT 1,
                CONSTRAINT "PK_b962152f6956deb45509e3e5023" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.combat_result (
                id serial NOT NULL,
                "dungeonId" integer NOT NULL,
                "userIds" json NOT NULL,
                "teamStats" json,
                result combat_result_result_enum NOT NULL,
                duration integer NOT NULL,
                rewards json,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_20661b7465bc3743baf4f53d9a3" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.combat_session (
                id serial NOT NULL,
                players json NOT NULL,
                enemies json NOT NULL,
                status character varying COLLATE pg_catalog."default" NOT NULL DEFAULT 'ongoing'::character varying,
                winner character varying COLLATE pg_catalog."default",
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_1a48230912dd7fdb6223e974980" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.donors (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                username character varying(100) COLLATE pg_catalog."default" NOT NULL,
                amount numeric(10, 2) NOT NULL,
                currency character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'USD'::character varying,
                tier donors_tier_enum NOT NULL,
                message text COLLATE pg_catalog."default",
                "donationDate" timestamp without time zone NOT NULL,
                status donors_status_enum NOT NULL DEFAULT 'active'::donors_status_enum,
                "isAnonymous" boolean NOT NULL DEFAULT false,
                metadata jsonb,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_7fafae759bcc8cc1dfa09c3fbcf" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.dungeon (
                id serial NOT NULL,
                name character varying COLLATE pg_catalog."default" NOT NULL,
                "levelRequirement" integer NOT NULL DEFAULT 1,
                "isHidden" boolean NOT NULL DEFAULT false,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "dropItems" json,
                "monsterIds" json NOT NULL DEFAULT '[]'::json,
                "monsterCounts" json NOT NULL DEFAULT '[]'::json,
                "requiredItem" integer,
                CONSTRAINT "PK_a0e09e42e58e4f30506bb32c3d9" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.guild (
                id serial NOT NULL,
                name character varying COLLATE pg_catalog."default" NOT NULL,
                funds integer NOT NULL DEFAULT 0,
                level integer NOT NULL DEFAULT 1,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "leaderId" integer,
                CONSTRAINT "PK_cfbbd0a2805cab7053b516068a3" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.guild_events (
                id serial NOT NULL,
                "guildId" integer NOT NULL,
                "eventType" guild_events_eventtype_enum NOT NULL,
                status guild_events_status_enum NOT NULL DEFAULT 'PENDING'::guild_events_status_enum,
                title character varying COLLATE pg_catalog."default",
                description character varying COLLATE pg_catalog."default",
                participants json,
                "eventData" json,
                "opponentGuildId" integer,
                "scheduledAt" timestamp without time zone,
                "completedAt" timestamp without time zone,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_1e73c34600e56a54c78d45048de" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.guild_members (
                id serial NOT NULL,
                "guildId" integer NOT NULL,
                "userId" integer NOT NULL,
                role guild_members_role_enum NOT NULL DEFAULT 'MEMBER'::guild_members_role_enum,
                "contributionGold" integer NOT NULL DEFAULT 0,
                "honorPoints" integer NOT NULL DEFAULT 0,
                "weeklyContribution" integer NOT NULL DEFAULT 0,
                "isOnline" boolean NOT NULL DEFAULT false,
                "joinedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "lastActiveAt" timestamp without time zone,
                CONSTRAINT "PK_d8df14c1079fd625f782c4f933c" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.guilds (
                id serial NOT NULL,
                name character varying COLLATE pg_catalog."default" NOT NULL,
                description character varying COLLATE pg_catalog."default",
                level integer NOT NULL DEFAULT 1,
                experience integer NOT NULL DEFAULT 0,
                "goldFund" integer NOT NULL DEFAULT 0,
                "maxMembers" integer NOT NULL DEFAULT 0,
                "currentMembers" integer NOT NULL DEFAULT 0,
                status guilds_status_enum NOT NULL DEFAULT 'ACTIVE'::guilds_status_enum,
                "leaderId" integer NOT NULL,
                announcement character varying COLLATE pg_catalog."default",
                settings json,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_e7e7f2a51bd6d96a9ac2aa560f9" PRIMARY KEY (id),
                CONSTRAINT "UQ_e6cf236d98ddbb9b7174626cd08" UNIQUE (name)
            );

            CREATE TABLE IF NOT EXISTS public.item (
                id serial NOT NULL,
                name character varying COLLATE pg_catalog."default" NOT NULL,
                rarity integer NOT NULL DEFAULT 1,
                stats json,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "consumableType" item_consumabletype_enum,
                type item_type_enum NOT NULL DEFAULT 'material'::item_type_enum,
                "consumableValue" integer,
                duration integer,
                price integer,
                "classRestrictions" json,
                "setId" integer,
                CONSTRAINT "PK_d3c0c71f23e7adcf952a1d13423" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.item_set_items (
                "setId" integer NOT NULL,
                "itemId" integer NOT NULL,
                CONSTRAINT "PK_9cfc7d749fbd7262b48322034dd" PRIMARY KEY ("setId", "itemId")
            );

            CREATE TABLE IF NOT EXISTS public.item_sets (
                id serial NOT NULL,
                name character varying(100) COLLATE pg_catalog."default" NOT NULL,
                description text COLLATE pg_catalog."default",
                rarity integer NOT NULL DEFAULT 1,
                "setBonuses" json NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5b97e2b33a40c74a494e21c76ce" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.level (
                id serial NOT NULL,
                level integer NOT NULL,
                "experienceRequired" integer NOT NULL,
                name character varying COLLATE pg_catalog."default",
                rewards json,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "maxHp" integer NOT NULL DEFAULT 100,
                "maxMp" integer NOT NULL DEFAULT 50,
                attack integer NOT NULL DEFAULT 10,
                defense integer NOT NULL DEFAULT 5,
                speed integer NOT NULL DEFAULT 8,
                CONSTRAINT "PK_d3f1a7a6f09f1c3144bacdc6bcc" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.mailbox (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                title character varying(200) COLLATE pg_catalog."default" NOT NULL,
                content text COLLATE pg_catalog."default" NOT NULL,
                type mailbox_type_enum NOT NULL DEFAULT 'system'::mailbox_type_enum,
                status mailbox_status_enum NOT NULL DEFAULT 'unread'::mailbox_status_enum,
                rewards jsonb,
                "expiresAt" timestamp without time zone,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_f7191e7ca96ddaeebb57e58650f" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.migrations (
                id serial NOT NULL,
                "timestamp" bigint NOT NULL,
                name character varying COLLATE pg_catalog."default" NOT NULL,
                CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.monsters (
                id serial NOT NULL,
                name character varying(100) COLLATE pg_catalog."default" NOT NULL,
                description text COLLATE pg_catalog."default",
                type monsters_type_enum NOT NULL DEFAULT 'normal'::monsters_type_enum,
                element monsters_element_enum NOT NULL DEFAULT 'neutral'::monsters_element_enum,
                level integer NOT NULL DEFAULT 1,
                "baseHp" integer NOT NULL DEFAULT 100,
                "baseAttack" integer NOT NULL DEFAULT 10,
                "baseDefense" integer NOT NULL DEFAULT 5,
                "experienceReward" integer NOT NULL DEFAULT 50,
                "goldReward" integer NOT NULL DEFAULT 10,
                "dropItems" json,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_54abad06b2131c35078519e9e19" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.pvp_matches (
                id serial NOT NULL,
                "matchType" pvp_matches_matchtype_enum NOT NULL DEFAULT 'ONE_VS_ONE'::pvp_matches_matchtype_enum,
                status pvp_matches_status_enum NOT NULL DEFAULT 'WAITING'::pvp_matches_status_enum,
                "winnerTeam" character varying COLLATE pg_catalog."default",
                "teamAScore" integer NOT NULL DEFAULT 0,
                "teamBScore" integer NOT NULL DEFAULT 0,
                "maxPlayersPerTeam" integer NOT NULL DEFAULT 0,
                "currentPlayersTeamA" integer NOT NULL DEFAULT 0,
                "currentPlayersTeamB" integer NOT NULL DEFAULT 0,
                "matchResult" json,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_88c2ed0cb8375659d88cd54d442" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.pvp_players (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "matchId" integer NOT NULL,
                team pvp_players_team_enum NOT NULL,
                "damageDealt" integer NOT NULL DEFAULT 0,
                "damageTaken" integer NOT NULL DEFAULT 0,
                kills integer NOT NULL DEFAULT 0,
                deaths integer NOT NULL DEFAULT 0,
                assists integer NOT NULL DEFAULT 0,
                "isReady" boolean NOT NULL DEFAULT false,
                "playerStats" json,
                "joinedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_90028d6e6465ad17dc367c1f8a5" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.quest_combat_tracking (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "questId" integer NOT NULL,
                "combatResultId" integer NOT NULL,
                "combatCompletedAt" timestamp without time zone NOT NULL,
                "questProgressUpdated" boolean NOT NULL DEFAULT false,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a1277f980e2ace155a4cbb156d1" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.quests (
                id serial NOT NULL,
                name character varying(100) COLLATE pg_catalog."default" NOT NULL,
                description text COLLATE pg_catalog."default" NOT NULL,
                type quests_type_enum NOT NULL DEFAULT 'side'::quests_type_enum,
                "requiredLevel" integer NOT NULL DEFAULT 1,
                requirements json NOT NULL,
                rewards json NOT NULL,
                "isActive" boolean NOT NULL DEFAULT false,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                dependencies json,
                "expiresAt" timestamp without time zone,
                "isRepeatable" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_a037497017b64f530fe09c75364" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.room_lobby (
                id serial NOT NULL,
                name character varying COLLATE pg_catalog."default" NOT NULL,
                "hostId" integer NOT NULL,
                "dungeonId" integer NOT NULL,
                status room_lobby_status_enum NOT NULL DEFAULT 'waiting'::room_lobby_status_enum,
                "minPlayers" integer NOT NULL DEFAULT 1,
                "maxPlayers" integer NOT NULL DEFAULT 4,
                "isPrivate" boolean NOT NULL DEFAULT false,
                password character varying COLLATE pg_catalog."default",
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_60c285dc935b0e6946935e6f424" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.room_player (
                id serial NOT NULL,
                "roomId" integer NOT NULL,
                "playerId" integer NOT NULL,
                status room_player_status_enum NOT NULL DEFAULT 'joined'::room_player_status_enum,
                "joinedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "leftAt" timestamp without time zone,
                "isReady" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_81a017130f13854fbe40520aca9" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.upgrade_log (
                id serial NOT NULL,
                "userItemId" integer NOT NULL,
                "userId" integer NOT NULL,
                "previousLevel" integer NOT NULL,
                "targetLevel" integer NOT NULL,
                result upgrade_log_result_enum NOT NULL,
                cost integer NOT NULL,
                "luckyCharmsUsed" integer NOT NULL DEFAULT 0,
                "successRate" double precision NOT NULL,
                "statsBonus" json,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_164f4c1e464de2173b077c22bbe" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public."user" (
                id serial NOT NULL,
                username character varying COLLATE pg_catalog."default" NOT NULL,
                password character varying COLLATE pg_catalog."default" NOT NULL,
                level integer NOT NULL DEFAULT 1,
                experience integer NOT NULL DEFAULT 0,
                gold integer NOT NULL DEFAULT 0,
                "guildId" integer,
                "characterClassId" integer,
                "isBanned" boolean NOT NULL DEFAULT false,
                "isAdmin" boolean NOT NULL DEFAULT false,
                "isDonor" boolean NOT NULL DEFAULT false,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY (id),
                CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE (username)
            );

            CREATE TABLE IF NOT EXISTS public.user_classes (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "classId" integer NOT NULL,
                level integer NOT NULL DEFAULT 1,
                experience integer NOT NULL DEFAULT 0,
                "isActive" boolean NOT NULL DEFAULT false,
                "unlockedAt" timestamp without time zone,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_6d279c608ff3fb8b0262b0b1a93" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.user_item (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "itemId" integer NOT NULL,
                quantity integer NOT NULL DEFAULT 1,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "upgradeLevel" integer NOT NULL DEFAULT 0,
                "maxUpgradeLevel" integer NOT NULL DEFAULT 10,
                "upgradeStats" json,
                "isEquipped" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_6f15f417e5d2ea53723fa47158a" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.user_quests (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "questId" integer NOT NULL,
                status user_quests_status_enum NOT NULL DEFAULT 'available'::user_quests_status_enum,
                progress json,
                "completedAt" timestamp without time zone,
                "startedAt" timestamp without time zone,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                "lastResetDate" date,
                "completionCount" integer NOT NULL DEFAULT 0,
                "rewardsClaimed" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_26397091cd37dde7d59fde6084d" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.user_stamina (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "currentStamina" integer NOT NULL DEFAULT 100,
                "maxStamina" integer NOT NULL DEFAULT 100,
                "lastRegenTime" timestamp without time zone NOT NULL DEFAULT now(),
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8b8b8b8b8b8b8b8b8b8b8b8b8b8" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.user_stat (
                id serial NOT NULL,
                "userId" integer NOT NULL,
                "levelId" integer NOT NULL,
                "currentHp" integer NOT NULL DEFAULT 100,
                "currentMp" integer NOT NULL DEFAULT 50,
                attack integer NOT NULL DEFAULT 10,
                defense integer NOT NULL DEFAULT 5,
                speed integer NOT NULL DEFAULT 8,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8b8b8b8b8b8b8b8b8b8b8b8b8b9" PRIMARY KEY (id)
            );

            CREATE TABLE IF NOT EXISTS public.world_boss (
                id serial NOT NULL,
                name character varying(100) COLLATE pg_catalog."default" NOT NULL,
                "currentHp" bigint NOT NULL DEFAULT 1000000,
                "maxHp" bigint NOT NULL DEFAULT 1000000,
                level integer NOT NULL DEFAULT 1,
                "isActive" boolean NOT NULL DEFAULT false,
                "spawnTime" timestamp without time zone,
                "defeatedAt" timestamp without time zone,
                "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
                "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8b8b8b8b8b8b8b8b8b8b8b8b8ba" PRIMARY KEY (id)
            );
        `);

    // Add foreign keys and indexes
    await queryRunner.query(`
            ALTER TABLE IF EXISTS public.boss_combat_log
                ADD CONSTRAINT "FK_535b091a37aeca6fd06d0e99e7" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE NO ACTION ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_535b091a37aeca6fd06d0e99e7" ON public.boss_combat_log ("userId");

            ALTER TABLE IF EXISTS public.boss_combat_log
                ADD CONSTRAINT "FK_59b57a4f91d6fdee151107f9e7" FOREIGN KEY ("bossId") REFERENCES public.world_boss (id) ON DELETE NO ACTION ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_59b57a4f91d6fdee151107f9e7" ON public.boss_combat_log ("bossId");

            ALTER TABLE IF EXISTS public.boss_damage_ranking
                ADD CONSTRAINT "FK_417120389b53bab615a00bdcc2" FOREIGN KEY ("bossId") REFERENCES public.world_boss (id) ON DELETE NO ACTION ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_417120389b53bab615a00bdcc2" ON public.boss_damage_ranking ("bossId");

            ALTER TABLE IF EXISTS public.boss_damage_ranking
                ADD CONSTRAINT "FK_7328a16e3443860037abe9d009" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE NO ACTION ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_7328a16e3443860037abe9d009" ON public.boss_damage_ranking ("userId");

            ALTER TABLE IF EXISTS public.character_advancements
                ADD CONSTRAINT "FK_23b09b1bdf033c4b6028441a45c" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.character_classes
                ADD CONSTRAINT "FK_d2a4801e17397302055ed80126c" FOREIGN KEY ("previousClassId") REFERENCES public.character_classes (id) ON DELETE SET NULL ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.chat_messages
                ADD CONSTRAINT "FK_43d968962b9e24e1e3517c0fbf" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE NO ACTION ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_43d968962b9e24e1e3517c0fbf" ON public.chat_messages ("userId");

            ALTER TABLE IF EXISTS public.combat_log
                ADD CONSTRAINT "FK_b962152f6956deb45509e3e5023" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.combat_result
                ADD CONSTRAINT "FK_20661b7465bc3743baf4f53d9a3" FOREIGN KEY ("dungeonId") REFERENCES public.dungeon (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.donors
                ADD CONSTRAINT "FK_7fafae759bcc8cc1dfa09c3fbcf" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.guild
                ADD CONSTRAINT "FK_cfbbd0a2805cab7053b516068a3" FOREIGN KEY ("leaderId") REFERENCES public."user" (id) ON DELETE SET NULL ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.guild_events
                ADD CONSTRAINT "FK_1e73c34600e56a54c78d45048de" FOREIGN KEY ("guildId") REFERENCES public.guilds (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.guild_members
                ADD CONSTRAINT "FK_d8df14c1079fd625f782c4f933c" FOREIGN KEY ("guildId") REFERENCES public.guilds (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.guild_members
                ADD CONSTRAINT "FK_d8df14c1079fd625f782c4f933d" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.guilds
                ADD CONSTRAINT "FK_e7e7f2a51bd6d96a9ac2aa560f9" FOREIGN KEY ("leaderId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.item
                ADD CONSTRAINT "FK_d3c0c71f23e7adcf952a1d13423" FOREIGN KEY ("setId") REFERENCES public.item_sets (id) ON DELETE SET NULL ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.item_set_items
                ADD CONSTRAINT "FK_9cfc7d749fbd7262b48322034dd" FOREIGN KEY ("setId") REFERENCES public.item_sets (id) ON DELETE CASCADE ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_8838cc1c3c666456fc55798a51" ON public.item_set_items ("setId");

            ALTER TABLE IF EXISTS public.item_set_items
                ADD CONSTRAINT "FK_9cfc7d749fbd7262b48322034de" FOREIGN KEY ("itemId") REFERENCES public.item (id) ON DELETE CASCADE ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_ab20dfc5650da69667399f4ec0" ON public.item_set_items ("itemId");

            ALTER TABLE IF EXISTS public.mailbox
                ADD CONSTRAINT "FK_f7191e7ca96ddaeebb57e58650f" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "IDX_984cdc86da77e5428180786db1" ON public.mailbox ("userId");

            ALTER TABLE IF EXISTS public.pvp_players
                ADD CONSTRAINT "FK_90028d6e6465ad17dc367c1f8a5" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.pvp_players
                ADD CONSTRAINT "FK_90028d6e6465ad17dc367c1f8a6" FOREIGN KEY ("matchId") REFERENCES public.pvp_matches (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.room_lobby
                ADD CONSTRAINT "FK_60c285dc935b0e6946935e6f424" FOREIGN KEY ("hostId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.room_lobby
                ADD CONSTRAINT "FK_60c285dc935b0e6946935e6f425" FOREIGN KEY ("dungeonId") REFERENCES public.dungeon (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.room_player
                ADD CONSTRAINT "FK_81a017130f13854fbe40520aca9" FOREIGN KEY ("roomId") REFERENCES public.room_lobby (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.room_player
                ADD CONSTRAINT "FK_81a017130f13854fbe40520acb0" FOREIGN KEY ("playerId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public."user"
                ADD CONSTRAINT "FK_cace4a159ff9f2512dd42373760" FOREIGN KEY ("guildId") REFERENCES public.guilds (id) ON DELETE SET NULL ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public."user"
                ADD CONSTRAINT "FK_cace4a159ff9f2512dd42373761" FOREIGN KEY ("characterClassId") REFERENCES public.character_classes (id) ON DELETE SET NULL ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_classes
                ADD CONSTRAINT "FK_6d279c608ff3fb8b0262b0b1a93" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_classes
                ADD CONSTRAINT "FK_6d279c608ff3fb8b0262b0b1a94" FOREIGN KEY ("classId") REFERENCES public.classes (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_item
                ADD CONSTRAINT "FK_6f15f417e5d2ea53723fa47158a" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_item
                ADD CONSTRAINT "FK_6f15f417e5d2ea53723fa47158b" FOREIGN KEY ("itemId") REFERENCES public.item (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_quests
                ADD CONSTRAINT "FK_26397091cd37dde7d59fde6084d" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_quests
                ADD CONSTRAINT "FK_26397091cd37dde7d59fde6084e" FOREIGN KEY ("questId") REFERENCES public.quests (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_stamina
                ADD CONSTRAINT "FK_8b8b8b8b8b8b8b8b8b8b8b8b8b8" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;

            ALTER TABLE IF EXISTS public.user_stat
                ADD CONSTRAINT "FK_8b8b8b8b8b8b8b8b8b8b8b8b8b9" FOREIGN KEY ("userId") REFERENCES public."user" (id) ON DELETE CASCADE ON UPDATE NO ACTION;
            CREATE INDEX IF NOT EXISTS "REL_711f33b7c83e2b58777eabadf1" ON public.user_stat ("userId");

            ALTER TABLE IF EXISTS public.user_stat
                ADD CONSTRAINT "FK_8b8b8b8b8b8b8b8b8b8b8b8b8ba" FOREIGN KEY ("levelId") REFERENCES public.level (id) ON DELETE CASCADE ON UPDATE NO ACTION;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order to avoid foreign key constraints
    await queryRunner.query(`
            DROP TABLE IF EXISTS public.boss_combat_log;
            DROP TABLE IF EXISTS public.boss_damage_ranking;
            DROP TABLE IF EXISTS public.character_advancements;
            DROP TABLE IF EXISTS public.character_classes;
            DROP TABLE IF EXISTS public.chat_messages;
            DROP TABLE IF EXISTS public.classes;
            DROP TABLE IF EXISTS public.combat_log;
            DROP TABLE IF EXISTS public.combat_result;
            DROP TABLE IF EXISTS public.combat_session;
            DROP TABLE IF EXISTS public.donors;
            DROP TABLE IF EXISTS public.dungeon;
            DROP TABLE IF EXISTS public.guild;
            DROP TABLE IF EXISTS public.guild_events;
            DROP TABLE IF EXISTS public.guild_members;
            DROP TABLE IF EXISTS public.guilds;
            DROP TABLE IF EXISTS public.item;
            DROP TABLE IF EXISTS public.item_set_items;
            DROP TABLE IF EXISTS public.item_sets;
            DROP TABLE IF EXISTS public.level;
            DROP TABLE IF EXISTS public.mailbox;
            DROP TABLE IF EXISTS public.monsters;
            DROP TABLE IF EXISTS public.pvp_matches;
            DROP TABLE IF EXISTS public.pvp_players;
            DROP TABLE IF EXISTS public.quest_combat_tracking;
            DROP TABLE IF EXISTS public.quests;
            DROP TABLE IF EXISTS public.room_lobby;
            DROP TABLE IF EXISTS public.room_player;
            DROP TABLE IF EXISTS public.upgrade_log;
            DROP TABLE IF EXISTS public."user";
            DROP TABLE IF EXISTS public.user_classes;
            DROP TABLE IF EXISTS public.user_item;
            DROP TABLE IF EXISTS public.user_quests;
            DROP TABLE IF EXISTS public.user_stamina;
            DROP TABLE IF EXISTS public.user_stat;
            DROP TABLE IF EXISTS public.world_boss;
            DROP TABLE IF EXISTS public.migrations;
        `);

    // Drop enums
    await queryRunner.query(`
            DROP TYPE IF EXISTS boss_combat_log_action_enum;
            DROP TYPE IF EXISTS boss_damage_ranking_rankingtype_enum;
            DROP TYPE IF EXISTS character_advancements_advancementstatus_enum;
            DROP TYPE IF EXISTS character_classes_type_enum;
            DROP TYPE IF EXISTS character_classes_tier_enum;
            DROP TYPE IF EXISTS chat_messages_type_enum;
            DROP TYPE IF EXISTS classes_tier_enum;
            DROP TYPE IF EXISTS classes_category_enum;
            DROP TYPE IF EXISTS combat_log_action_enum;
            DROP TYPE IF EXISTS combat_result_result_enum;
            DROP TYPE IF EXISTS donors_tier_enum;
            DROP TYPE IF EXISTS donors_status_enum;
            DROP TYPE IF EXISTS guild_events_eventtype_enum;
            DROP TYPE IF EXISTS guild_events_status_enum;
            DROP TYPE IF EXISTS guild_members_role_enum;
            DROP TYPE IF EXISTS guilds_status_enum;
            DROP TYPE IF EXISTS item_consumabletype_enum;
            DROP TYPE IF EXISTS item_type_enum;
            DROP TYPE IF EXISTS mailbox_type_enum;
            DROP TYPE IF EXISTS mailbox_status_enum;
            DROP TYPE IF EXISTS monsters_type_enum;
            DROP TYPE IF EXISTS monsters_element_enum;
            DROP TYPE IF EXISTS pvp_matches_matchtype_enum;
            DROP TYPE IF EXISTS pvp_matches_status_enum;
            DROP TYPE IF EXISTS pvp_players_team_enum;
            DROP TYPE IF EXISTS quests_type_enum;
            DROP TYPE IF EXISTS room_lobby_status_enum;
            DROP TYPE IF EXISTS room_player_status_enum;
            DROP TYPE IF EXISTS upgrade_log_result_enum;
            DROP TYPE IF EXISTS user_quests_status_enum;
        `);
  }
}

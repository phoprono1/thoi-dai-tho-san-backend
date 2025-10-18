import { Module, DynamicModule } from '@nestjs/common';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import all modules
import { ClassesModule } from './classes/classes.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { CombatResultsModule } from './combat-results/combat-results.module';
import { DailyLoginModule } from './daily-login/daily-login.module';
import { DungeonsModule } from './dungeons/dungeons.module';
import { LevelsModule } from './levels/levels.module';
import { UserItemsModule } from './user-items/user-items.module';
import { UserStaminaModule } from './user-stamina/user-stamina.module';
import { UserStatsModule } from './user-stats/user-stats.module';
import { RoomLobbyModule } from './dungeons/room-lobby.module';
import { PvpModule } from './pvp/pvp.module';
import { GuildModule } from './guild/guild.module';
import { ChatModule } from './chat/chat.module';
import { WorldBossModule } from './world-boss/world-boss.module';
import { MailboxModule } from './mailbox/mailbox.module';
import { GiftCodeModule } from './giftcode/giftcode.module';
import { CharacterClassesModule } from './character-classes/character-classes.module';
import { EventsModule } from './events/events.module';
import { DonorsModule } from './donors/donors.module';
import { TitlesModule } from './titles/titles.module';
import { CraftingModule } from './crafting/crafting.module';
import { QuestModule } from './quests/quest.module';
import { StoryEventsModule } from './story-events/story-events.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MonsterModule } from './monsters/monster.module';
import { AdminImportModule } from './admin-import/admin-import.module';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthModule } from './health/health.module';
import { MarketModule } from './market/market.module';
import { ExploreModule } from './explore/explore.module';
import { UserAttributesModule } from './user-attributes/user-attributes.module';
import { SkillModule } from './player-skills/skill.module';
import { GachaModule } from './gacha/gacha.module';
import { WildAreaModule } from './wildarea/wildarea.module';
import { PetsModule } from './pets/pets.module';
import { CasinoModule } from './casino/casino.module';

// ServeStatic DynamicModule instance for serving backend/assets at /assets
// Narrow ts-ignore to the known interop call only
const ServeStaticDynamic: DynamicModule =
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: forRoot exists at runtime; keep this narrow to avoid lint noise
  (
    ServeStaticModule as unknown as {
      forRoot: (opts: any) => DynamicModule;
    }
  ).forRoot({
    // Serve the assets directory relative to the runtime working directory.
    // main.ts creates the assets folder using process.cwd(), and in some
    // container setups __dirname (compiled code location) differs from the
    // process working directory. Using process.cwd() ensures ServeStatic
    // serves the same location that the app creates and writes files to.
    rootPath: join(process.cwd(), 'assets'),
    serveRoot: '/assets',
  });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 🛡️ ANTI-MULTIACCOUNTING: Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per minute (default)
      },
    ]),
    // Create DynamicModule instances separately and cast them to avoid
    // false-positive eslint "no-unsafe-*" rules when complex expressions
    // are used directly inside the decorator.
    ((): DynamicModule => {
      const mod = TypeOrmModule.forRoot({
        type: 'postgres',
        ...(process.env.DATABASE_URL
          ? {
              url: process.env.DATABASE_URL,
              ssl:
                process.env.NODE_ENV === 'production'
                  ? { rejectUnauthorized: false }
                  : false,
            }
          : {
              host: process.env.DB_HOST || 'localhost',
              port: parseInt(process.env.DB_PORT || '5432'),
              username: process.env.DB_USERNAME || 'postgres',
              password: process.env.DB_PASSWORD || 'password',
              database: process.env.DB_DATABASE || 'thoi_dai_tho_san_v2',
            }),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Only enable synchronize when explicitly requested via env var to avoid
        // accidental schema changes at runtime. Default: false.
        synchronize: false,
        // Disable verbose SQL logging by default; set TYPEORM_LOGGING=true to enable
        logging: process.env.TYPEORM_LOGGING === 'true',
      });
      return mod;
    })(),
    // Serve static assets (images) from backend/assets -> accessible at /assets/*
    ServeStaticDynamic,
    ScheduleModule.forRoot(),
    CommonModule,
    HealthModule,
    EventsModule,
    ClassesModule,
    AuthModule,
    UsersModule,
    ItemsModule,
    CombatResultsModule,
    DailyLoginModule,
    DungeonsModule,
    LevelsModule,
    UserItemsModule,
    UserStaminaModule,
    UserStatsModule,
    RoomLobbyModule,
    PvpModule,
    GuildModule,
    ChatModule,
    WorldBossModule,
    MailboxModule,
    GiftCodeModule,
    CharacterClassesModule,
    DonorsModule,
    TitlesModule,
    CraftingModule,
    QuestModule,
    StoryEventsModule,
    MonsterModule,
    UploadsModule,
    GachaModule,
    AdminImportModule,
    AdminModule,
    MarketModule,
    ExploreModule,
    WildAreaModule,
    UserAttributesModule,
    SkillModule,
    PetsModule,
    CasinoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

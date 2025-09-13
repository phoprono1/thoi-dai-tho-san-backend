import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import all modules
import { ClassesModule } from './classes/classes.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { CombatResultsModule } from './combat-results/combat-results.module';
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
import { CharacterClassesModule } from './character-classes/character-classes.module';
import { DonorsModule } from './donors/donors.module';
import { QuestModule } from './quests/quest.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MonsterModule } from './monsters/monster.module';
import { AdminImportModule } from './admin-import/admin-import.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
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
            database: process.env.DB_DATABASE || 'thoi_dai_tho_san',
          }),
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development', // Only sync in development
      // Disable verbose SQL logging by default; set TYPEORM_LOGGING=true to enable
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    HealthModule,
    ClassesModule,
    AuthModule,
    UsersModule,
    ItemsModule,
    CombatResultsModule,
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
    CharacterClassesModule,
    DonorsModule,
    QuestModule,
    MonsterModule,
    AdminImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

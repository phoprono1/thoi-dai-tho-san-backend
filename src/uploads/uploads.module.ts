import { Module } from '@nestjs/common';
import { MonsterModule } from '../monsters/monster.module';
import { DungeonsModule } from '../dungeons/dungeons.module';
import { ItemsModule } from '../items/items.module';
import { WorldBossModule } from '../world-boss/world-boss.module';
import { SkillDefinitionModule } from '../player-skills/skill-definition.module';
import { PetsModule } from '../pets/pets.module';
import { UploadsController } from './uploads.controller';
import { CasinoModule } from '../casino/casino.module';

@Module({
  imports: [
    MonsterModule,
    DungeonsModule,
    ItemsModule,
    WorldBossModule,
    SkillDefinitionModule,
    PetsModule,
    CasinoModule,
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}

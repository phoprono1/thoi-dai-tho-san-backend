import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillController } from './skill.controller';
import { SkillService } from './skill.service';
import { PlayerSkill } from './player-skill.entity';
import { UserStatsModule } from '../user-stats/user-stats.module';
import { User } from '../users/user.entity';
import { SkillDefinitionModule } from './skill-definition.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlayerSkill, User]),
    UserStatsModule,
    SkillDefinitionModule,
  ],
  controllers: [SkillController],
  providers: [SkillService],
  exports: [SkillService],
})
export class SkillModule {}

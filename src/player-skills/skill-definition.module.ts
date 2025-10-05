import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillDefinition } from './skill-definition.entity';
import { PlayerSkill } from './player-skill.entity';
import { SkillDefinitionService } from './skill-definition.service';
import { SkillDefinitionController } from './skill-definition.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SkillDefinition, PlayerSkill])],
  providers: [SkillDefinitionService],
  controllers: [SkillDefinitionController],
  exports: [SkillDefinitionService],
})
export class SkillDefinitionModule {}

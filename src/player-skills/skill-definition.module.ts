import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillDefinition } from './skill-definition.entity';
import { SkillDefinitionService } from './skill-definition.service';
import { SkillDefinitionController } from './skill-definition.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SkillDefinition])],
  providers: [SkillDefinitionService],
  controllers: [SkillDefinitionController],
  exports: [SkillDefinitionService],
})
export class SkillDefinitionModule {}

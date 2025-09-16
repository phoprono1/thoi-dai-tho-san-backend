import { Module } from '@nestjs/common';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { MonstersModule } from '../monsters/monsters.module';
import { CombatResultsModule } from '../combat-results/combat-results.module';
import { UserStaminaModule } from '../user-stamina/user-stamina.module';

@Module({
  imports: [MonstersModule, CombatResultsModule, UserStaminaModule],
  controllers: [ExploreController],
  providers: [ExploreService],
})
export class ExploreModule {}

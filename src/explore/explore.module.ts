import { Module } from '@nestjs/common';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { WildAreaModule } from '../wildarea/wildarea.module';
import { CombatResultsModule } from '../combat-results/combat-results.module';
import { UserStaminaModule } from '../user-stamina/user-stamina.module';

@Module({
  imports: [WildAreaModule, CombatResultsModule, UserStaminaModule],
  controllers: [ExploreController],
  providers: [ExploreService],
})
export class ExploreModule {}

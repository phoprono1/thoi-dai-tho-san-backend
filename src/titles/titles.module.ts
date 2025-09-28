import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TitlesController } from './titles.controller';
import { TitlesService } from './titles.service';
import { Title } from './title.entity';
import { UserTitle } from './user-title.entity';
import { CombatResult } from '../combat-results/combat-result.entity';
import { User } from '../users/user.entity';
import { UserItemsModule } from '../user-items/user-items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Title, UserTitle, CombatResult, User]),
    forwardRef(() => UserItemsModule),
  ],
  controllers: [TitlesController],
  providers: [TitlesService],
  exports: [TitlesService],
})
export class TitlesModule {}

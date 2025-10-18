import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScratchCardController } from './scratch-card.controller';
import { ScratchCardService } from './scratch-card.service';
import { ScratchCardType } from './scratch-card-type.entity';
import { ScratchCardTypePrize } from './scratch-card-type-prize.entity';
import { UserScratchCard } from './user-scratch-card.entity';
import { TitleTaxReduction } from './title-tax-reduction.entity';
import { User } from '../../users/user.entity';
import { Title } from '../../titles/title.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScratchCardType,
      ScratchCardTypePrize,
      UserScratchCard,
      TitleTaxReduction,
      User,
      Title,
    ]),
  ],
  controllers: [ScratchCardController],
  providers: [ScratchCardService],
  exports: [ScratchCardService],
})
export class ScratchCardModule {}

import { Module } from '@nestjs/common';
import { ScratchCardModule } from './scratch-card/scratch-card.module';

@Module({
  imports: [ScratchCardModule],
  exports: [ScratchCardModule],
})
export class CasinoModule {}

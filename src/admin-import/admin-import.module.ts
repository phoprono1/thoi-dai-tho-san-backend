import { Module } from '@nestjs/common';
import { AdminImportController } from './admin-import.controller';
import { AdminImportService } from './admin-import.service';
import { AdminExportController } from './admin-export.controller';

@Module({
  controllers: [AdminImportController, AdminExportController],
  providers: [AdminImportService],
  exports: [AdminImportService],
})
export class AdminImportModule {}

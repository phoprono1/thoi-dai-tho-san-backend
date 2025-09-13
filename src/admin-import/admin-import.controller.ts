/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  Req,
  Get,
  Param as GetParam,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AdminImportService } from './admin-import.service';

@Controller('admin/import')
export class AdminImportController {
  constructor(private readonly importService: AdminImportService) {}

  @Post(':resource')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './tmp/uploads',
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadCSV(
    @Param('resource') resource: string,
    // avoid referencing Express.Multer types to keep build portable
    @UploadedFile() file: any,
    @Req() req: any,
    @Body() body: any,
  ) {
    // Defensive validation: multer expects multipart/form-data with field name 'file'.
    // If clients send JSON (Content-Type: application/json) without multipart form,
    // `file` will be undefined and downstream code will throw a 500. Return a clear 400 instead.
    if (!file) {
      throw new BadRequestException(
        'Missing uploaded file. Ensure the request is multipart/form-data and the file field name is "file".',
      );
    }
    // security: ensure only admins call this (assume guard elsewhere)
    const userId = req.user?.id || null;
    // If client asked for synchronous processing (e.g., admin UI wants immediate feedback)
    if (body && (body.sync === true || body.sync === 'true')) {
      const result = await this.importService.processInline({
        resource,
        filePath: file.path,
        options: body || {},
        initiatedBy: userId,
      });
      return result;
    }

    const jobId = await this.importService.enqueueImport({
      resource,
      filePath: file.path,
      options: body || {},
      initiatedBy: userId,
    });
    return { jobId };
  }

  @Get('jobs/:jobId')
  async jobStatus(@GetParam('jobId') jobId: string) {
    return this.importService.getJobStatus(jobId);
  }
}

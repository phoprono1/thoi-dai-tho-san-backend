import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = path.resolve(process.cwd(), 'tmp', 'uploads');

@Injectable()
export class AdminImportService {
  private readonly logger = new Logger(AdminImportService.name);
  private queue: any = null;

  constructor(private readonly dataSource: DataSource) {
    // Lazy initialize queue when first used to avoid startup issues if BullMQ not configured
  }

  private ensureUploadDir() {
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async enqueueImport(payload: {
    resource: string;
    filePath: string;
    options?: any;
    initiatedBy?: number | null;
  }): Promise<string> {
    this.ensureUploadDir();
    // Create a lightweight job id
    const jobId = randomUUID();

    // Defer to a bull queue if available; if not, run inline (safe fallback)
    try {
      // Dynamically require bullmq to avoid hard dependency at module load

      const { Queue } = require('bullmq');
      const IORedis = require('ioredis');
      const connection = new IORedis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });
      this.queue = new Queue('admin-import', { connection });
      await this.queue.add('import', payload, { jobId });
      this.logger.debug(
        `Enqueued import job ${jobId} for resource ${payload.resource}`,
      );
      return jobId;
    } catch (err) {
      this.logger.warn(
        'BullMQ not available or failed to enqueue; falling back to inline processing',
        err,
      );
      // Inline processing fallback: do not auto-start here. Caller may opt-in
      // to synchronous inline processing by calling processInline. Return jobId
      // so callers can track.
      return jobId;
    }
  }

  /**
   * Returns true when a Bull queue is available and being used.
   */
  queueAvailable() {
    return !!this.queue;
  }

  /**
   * Process the import job inline (synchronously) and return the processor result.
   * This avoids the background setImmediate fallback and gives the controller
   * the ability to return the parse/save result immediately to the client.
   */
  async processInline(payload: {
    resource: string;
    filePath: string;
    options?: any;
    initiatedBy?: number | null;
  }) {
    const jobId = randomUUID();
    try {
      // Dynamically require the processor which exports processImportJob
      // CommonJS export: module.exports = { processImportJob }

      const processor = require('./admin-import.processor');
      // processor.processImportJob expects an object like { id, data }
      // Pass the application's DataSource so processor/handlers use the same
      // connection instead of the standalone AppDataSource.
      const result = await processor.processImportJob(
        {
          id: jobId,
          data: payload,
        },
        this.dataSource,
      );
      return { jobId, result };
    } catch (err) {
      this.logger.error('Inline import processing failed', err);
      return { jobId, result: { success: false, error: String(err) } };
    }
  }

  async getJobStatus(jobId: string) {
    if (!this.queue) return { jobId, status: 'unknown' };
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return { jobId, status: 'not_found' };
      const state = await job.getState();
      // job.progress() has differing types across bull versions; avoid calling
      const progress = job.progress || null;
      return { jobId, state, progress, returnvalue: job.returnvalue };
    } catch (err) {
      return { jobId, status: 'error', error: String(err) };
    }
  }
}

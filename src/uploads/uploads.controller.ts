/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonsterService } from '../monsters/monster.service';
import { DungeonsService } from '../dungeons/dungeons.service';
import { ItemsService } from '../items/items.service';
import { WorldBossService } from '../world-boss/world-boss.service';
import { extname, join } from 'path';
import * as fs from 'fs';
import { parse } from 'path';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// Use any for multer file types to avoid needing extra @types packages in this change
function imageFileFilter(
  req: any,
  file: any,
  cb: (err: any, acceptFile?: boolean) => void,
) {
  if (!file.mimetype || !String(file.mimetype).startsWith('image/')) {
    return cb(new BadRequestException('Only image files are allowed'), false);
  }
  cb(null, true);
}

@Controller('uploads')
export class UploadsController {
  constructor(
    private monsterService: MonsterService,
    private dungeonsService: DungeonsService,
    private itemsService: ItemsService,
    private worldBossService: WorldBossService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('monsters/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      // Multer storage callbacks involve untyped node-style callbacks; narrow the eslint
      // suppression to this block to avoid project-wide rule relaxations.
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
      storage: diskStorage({
        destination: (req, file, cb) => {
          // multer gives a callback with signature (err, destination)
          cb(null, join(process.cwd(), 'assets', 'monsters'));
        },
        filename: (req, file, cb) => {
          const original = String((file && file.originalname) || '');
          const name = `${randomUUID()}${extname(original)}`;
          cb(null, name);
        },
      }),
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    }),
  )
  async uploadMonsterImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rel = `/assets/monsters/${file.filename}`;
    await this.monsterService.updateMonster(+id, { image: rel } as any);
    // Generate thumbnails (64x64 and 256x256) synchronously to improve UX
    try {
      const thumbsDir = join(process.cwd(), 'assets', 'monsters', 'thumbs');
      if (!fs.existsSync(thumbsDir))
        fs.mkdirSync(thumbsDir, { recursive: true });
      const originalPath = join(
        process.cwd(),
        'assets',
        'monsters',
        file.filename,
      );
      const parsed = parse(file.filename);
      const base = parsed.name;
      const smallName = `${base}_64.webp`;
      const mediumName = `${base}_256.webp`;
      // Safely resolve sharp whether it's exported as default (ESM) or as module.exports (CJS)
      const sharpModule = await import('sharp');
      // sharpModule may be a function (CJS), or an object with .default (ESM). Normalize:

      const sharpLib: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLib !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLib,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }
      // If uploaded file is AVIF but this sharp build lacks AVIF input support,
      // bail early with a helpful warning so the admin knows why thumbnails are missing.
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpLib.format &&
          sharpLib.format.avif &&
          sharpLib.format.avif.input) ||
          (sharpLib.format &&
            sharpLib.format.heif &&
            sharpLib.format.heif.input),
      );
      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected but AVIF input not supported by sharp build',
          {
            file: originalPath,
          },
        );
        return {
          path: rel,
          warning: 'AVIF not supported by server; thumbnails not generated',
        };
      }
      await sharpLib(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpLib(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));
      const smallRel = `/assets/monsters/thumbs/${smallName}`;
      const mediumRel = `/assets/monsters/thumbs/${mediumName}`;
      return { path: rel, thumbnails: { small: smallRel, medium: mediumRel } };
    } catch (err) {
      // If thumbnail generation fails, log and return original path
      console.warn('Thumbnail generation failed for monster:', {
        error: String(err),
        file: String(file?.filename),
      });
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('dungeons/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
      storage: diskStorage({
        destination: (req, file, cb) =>
          cb(null, join(process.cwd(), 'assets', 'dungeons')),
        filename: (req, file, cb) => {
          const original = String((file && file.originalname) || '');
          cb(null, `${randomUUID()}${extname(original)}`);
        },
      }),
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
    }),
  )
  async uploadDungeonImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rel = `/assets/dungeons/${file.filename}`;
    await this.dungeonsService.update(+id, { image: rel } as any);
    try {
      const thumbsDir = join(process.cwd(), 'assets', 'dungeons', 'thumbs');
      if (!fs.existsSync(thumbsDir))
        fs.mkdirSync(thumbsDir, { recursive: true });
      const originalPath = join(
        process.cwd(),
        'assets',
        'dungeons',
        file.filename,
      );
      const parsed = parse(file.filename);
      const base = parsed.name;
      const smallName = `${base}_64.webp`;
      const mediumName = `${base}_256.webp`;
      const sharpModule = await import('sharp');

      const sharpLib: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLib !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLib,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpLib.format &&
          sharpLib.format.avif &&
          sharpLib.format.avif.input) ||
          (sharpLib.format &&
            sharpLib.format.heif &&
            sharpLib.format.heif.input),
      );
      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected but AVIF input not supported by sharp build',
          {
            file: originalPath,
          },
        );
        return {
          path: rel,
          warning: 'AVIF not supported by server; thumbnails not generated',
        };
      }
      await sharpLib(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpLib(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));
      const smallRel = `/assets/dungeons/thumbs/${smallName}`;
      const mediumRel = `/assets/dungeons/thumbs/${mediumName}`;
      return { path: rel, thumbnails: { small: smallRel, medium: mediumRel } };
    } catch (err) {
      console.warn('Thumbnail generation failed for dungeon:', {
        error: String(err),
        file: String(file?.filename),
      });
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('items/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
      storage: diskStorage({
        destination: (req, file, cb) =>
          cb(null, join(process.cwd(), 'assets', 'items')),
        filename: (req, file, cb) => {
          const original = String((file && file.originalname) || '');
          cb(null, `${randomUUID()}${extname(original)}`);
        },
      }),
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
    }),
  )
  async uploadItemImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rel = `/assets/items/${file.filename}`;
    await this.itemsService.update(+id, { image: rel } as any);
    try {
      const thumbsDir = join(process.cwd(), 'assets', 'items', 'thumbs');
      if (!fs.existsSync(thumbsDir))
        fs.mkdirSync(thumbsDir, { recursive: true });
      const originalPath = join(
        process.cwd(),
        'assets',
        'items',
        file.filename,
      );
      const parsed = parse(file.filename);
      const base = parsed.name;
      const smallName = `${base}_64.webp`;
      const mediumName = `${base}_256.webp`;
      const sharpModule = await import('sharp');

      const sharpLib: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLib !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLib,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpLib.format &&
          sharpLib.format.avif &&
          sharpLib.format.avif.input) ||
          (sharpLib.format &&
            sharpLib.format.heif &&
            sharpLib.format.heif.input),
      );
      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected but AVIF input not supported by sharp build',
          {
            file: originalPath,
          },
        );
        return {
          path: rel,
          warning: 'AVIF not supported by server; thumbnails not generated',
        };
      }
      await sharpLib(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpLib(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));
      const smallRel = `/assets/items/thumbs/${smallName}`;
      const mediumRel = `/assets/items/thumbs/${mediumName}`;
      // Persist medium thumbnail to item record so clients don't need to PATCH separately
      try {
        await this.itemsService.update(+id, { image: mediumRel } as any);
      } catch (e) {
        console.warn('Failed to persist item image after upload', {
          id,
          error: e,
        });
      }
      return { path: rel, thumbnails: { small: smallRel, medium: mediumRel } };
    } catch (err) {
      console.warn('Thumbnail generation failed for item:', {
        error: String(err),
        file: String(file?.filename),
      });
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('world-boss')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, join(process.cwd(), 'assets', 'world-boss'));
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadWorldBossImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const rel = `/assets/world-boss/${file.filename}`;
    const originalPath = file.path;
    const thumbsDir = join(process.cwd(), 'assets', 'world-boss', 'thumbs');
    
    // Ensure thumbs directory exists
    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }

    try {
      const { name } = parse(file.filename);
      const smallName = `${name}_64.webp`;
      const mediumName = `${name}_256.webp`;

      // Try to generate thumbnails
      const sharpLib = await import('sharp');
      if (!sharpLib || !sharpLib.default) {
        console.warn('Sharp not available for world boss thumbnails');
        return { path: rel };
      }

      // Check AVIF support
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpLib.format &&
          sharpLib.format.avif &&
          sharpLib.format.avif.input) ||
          (sharpLib.format &&
            sharpLib.format.heif &&
            sharpLib.format.heif.input),
      );
      
      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected but AVIF input not supported by sharp build',
          { file: originalPath },
        );
        return {
          path: rel,
          warning: 'AVIF not supported by server; thumbnails not generated',
        };
      }

      await sharpLib.default(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      
      await sharpLib.default(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));

      const smallRel = `/assets/world-boss/thumbs/${smallName}`;
      const mediumRel = `/assets/world-boss/thumbs/${mediumName}`;
      
      return { 
        path: rel, 
        thumbnails: { small: smallRel, medium: mediumRel } 
      };
    } catch (err) {
      console.warn('Thumbnail generation failed for world boss:', {
        error: String(err),
        file: String(file?.filename),
      });
      return { path: rel };
    }
  }
}

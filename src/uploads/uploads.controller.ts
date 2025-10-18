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
import { SkillDefinitionService } from '../player-skills/skill-definition.service';
import { PetService } from '../pets/pet.service';
import { ScratchCardService } from '../casino/scratch-card/scratch-card.service';
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
    private skillDefinitionService: SkillDefinitionService,
    private petService: PetService,
    private scratchCardService: ScratchCardService,
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

      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLibAny,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      // If uploaded file is AVIF but this sharp build lacks AVIF input support,
      // bail early with a helpful warning so the admin knows why thumbnails are missing.
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
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

      // Detect animated/multi-page inputs (GIF, animated WebP, etc.). If animated,
      // libvips/sharp may flatten to the first frame when resizing. As a safe fallback
      // we preserve the original animated file into the thumbs folder so animation isn't lost.
      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );
        if (isAnimated) {
          // Copy original into thumbs using original extension so animation is preserved
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${base}_64${origExt}`;
            const mediumOrigName = `${base}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/monsters/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/monsters/thumbs/${mediumOrigName}`;
            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated file into thumbs:', {
              error: String(copyErr),
            });
            // Fall through to attempt normal resizing (best-effort)
          }
        }
      } catch (mErr) {
        // If metadata fails for some reason, log and continue with normal resize attempt
        console.warn('Failed to read metadata for thumbnail decision:', {
          error: String(mErr),
        });
      }

      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpInstance(originalPath)
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
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLibAny,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
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

      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );
        if (isAnimated) {
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${base}_64${origExt}`;
            const mediumOrigName = `${base}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/dungeons/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/dungeons/thumbs/${mediumOrigName}`;
            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated file into thumbs:', {
              error: String(copyErr),
            });
          }
        }
      } catch (mErr) {
        console.warn('Failed to read metadata for thumbnail decision:', {
          error: String(mErr),
        });
      }

      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpInstance(originalPath)
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
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLibAny,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
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

      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );
        if (isAnimated) {
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${base}_64${origExt}`;
            const mediumOrigName = `${base}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/items/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/items/thumbs/${mediumOrigName}`;
            // Persist medium thumbnail to item record so clients don't need to PATCH separately
            try {
              await this.itemsService.update(+id, { image: mediumRel } as any);
            } catch (e) {
              console.warn('Failed to persist item image after upload', {
                id,
                error: e,
              });
            }
            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated file into thumbs:', {
              error: String(copyErr),
            });
          }
        }
      } catch (mErr) {
        console.warn('Failed to read metadata for thumbnail decision:', {
          error: String(mErr),
        });
      }

      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpInstance(originalPath)
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
          const worldBossDir = join(process.cwd(), 'assets', 'world-boss');
          // Ensure world-boss directory exists
          if (!fs.existsSync(worldBossDir)) {
            fs.mkdirSync(worldBossDir, { recursive: true });
          }
          cb(null, worldBossDir);
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

      const sharpModule = await import('sharp');
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLibAny,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
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

      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );
        if (isAnimated) {
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${name}_64${origExt}`;
            const mediumOrigName = `${name}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/world-boss/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/world-boss/thumbs/${mediumOrigName}`;
            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated file into thumbs:', {
              error: String(copyErr),
            });
          }
        }
      } catch (mErr) {
        console.warn('Failed to read metadata for thumbnail decision:', {
          error: String(mErr),
        });
      }

      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));

      await sharpInstance(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));

      const smallRel = `/assets/world-boss/thumbs/${smallName}`;
      const mediumRel = `/assets/world-boss/thumbs/${mediumName}`;

      return {
        path: rel,
        thumbnails: { small: smallRel, medium: mediumRel },
      };
    } catch (err) {
      console.warn('Thumbnail generation failed for world boss:', {
        error: String(err),
        file: String(file?.filename),
      });
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('skills/:skillId')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const skillsDir = join(process.cwd(), 'assets', 'skills');
          // Ensure skills directory exists
          if (!fs.existsSync(skillsDir)) {
            fs.mkdirSync(skillsDir, { recursive: true });
          }
          cb(null, skillsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadSkillImage(
    @Param('skillId') skillId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const rel = `/assets/skills/${file.filename}`;
    const originalPath = file.path;
    const thumbsDir = join(process.cwd(), 'assets', 'skills', 'thumbs');

    // Ensure thumbs directory exists
    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }

    try {
      const { name } = parse(file.filename);
      const smallName = `${name}_64.webp`;
      const mediumName = `${name}_256.webp`;

      const sharpModule = await import('sharp');
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          typeofSharp: typeof sharpLibAny,
          sharpModuleKeys: Object.keys(sharpModule || {}),
          file: originalPath,
        });
        // Update skill definition even if thumbnail generation fails
        await this.skillDefinitionService.updateSkillDefinition(skillId, {
          image: rel,
        } as any);
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
      );

      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected but AVIF input not supported by sharp build',
          { file: originalPath },
        );
        await this.skillDefinitionService.updateSkillDefinition(skillId, {
          image: rel,
        } as any);
        return {
          path: rel,
          warning: 'AVIF not supported by server; thumbnails not generated',
        };
      }

      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );
        if (isAnimated) {
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${name}_64${origExt}`;
            const mediumOrigName = `${name}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/skills/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/skills/thumbs/${mediumOrigName}`;
            // Update skill definition with medium thumbnail
            await this.skillDefinitionService.updateSkillDefinition(skillId, {
              image: mediumRel,
            } as any);
            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated file into thumbs:', {
              error: String(copyErr),
            });
          }
        }
      } catch (mErr) {
        console.warn('Failed to read metadata for thumbnail decision:', {
          error: String(mErr),
        });
      }

      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));

      await sharpInstance(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));

      const smallRel = `/assets/skills/thumbs/${smallName}`;
      const mediumRel = `/assets/skills/thumbs/${mediumName}`;

      // Update skill definition with medium thumbnail
      await this.skillDefinitionService.updateSkillDefinition(skillId, {
        image: mediumRel,
      } as any);

      return {
        path: rel,
        thumbnails: { small: smallRel, medium: mediumRel },
      };
    } catch (err) {
      console.warn('Thumbnail generation failed for skill:', {
        error: String(err),
        file: String(file?.filename),
      });
      // Still update skill definition with original image
      try {
        await this.skillDefinitionService.updateSkillDefinition(skillId, {
          image: rel,
        } as any);
      } catch (updateErr) {
        console.warn('Failed to update skill definition:', {
          skillId,
          error: String(updateErr),
        });
      }
      return { path: rel };
    }
  }

  // Pet System Upload Endpoints

  @UseGuards(JwtAuthGuard)
  @Post('pets/definitions/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const petsDir = join(process.cwd(), 'assets', 'pets');
          if (!fs.existsSync(petsDir)) {
            fs.mkdirSync(petsDir, { recursive: true });
          }
          cb(null, petsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `pet_${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadPetImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const rel = `/assets/pets/${file.filename}`;
    const originalPath = file.path;
    const thumbsDir = join(process.cwd(), 'assets', 'pets', 'thumbs');

    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }

    try {
      const { name } = parse(file.filename);
      const smallName = `${name}_64.webp`;
      const mediumName = `${name}_256.webp`;

      const sharpModule = await import('sharp');
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;

      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function', {
          file: originalPath,
        });
        // Add image to pet definition even if thumbnail generation fails
        await this.petService.addImageToPetDefinition(+id, rel);
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
      );

      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn('AVIF upload detected but AVIF input not supported', {
          file: originalPath,
        });
        await this.petService.addImageToPetDefinition(+id, rel);
        return {
          path: rel,
          warning: 'AVIF not supported; thumbnails not generated',
        };
      }

      // Handle animated images (GIFs)
      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );

        if (isAnimated) {
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${name}_64${origExt}`;
            const mediumOrigName = `${name}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/pets/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/pets/thumbs/${mediumOrigName}`;

            await this.petService.addImageToPetDefinition(+id, rel);

            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated file:', {
              error: String(copyErr),
            });
          }
        }
      } catch (mErr) {
        console.warn('Failed to read metadata:', {
          error: String(mErr),
        });
      }

      // Generate thumbnails for static images
      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));

      await sharpInstance(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));

      const smallRel = `/assets/pets/thumbs/${smallName}`;
      const mediumRel = `/assets/pets/thumbs/${mediumName}`;

      // Add image to pet definition
      await this.petService.addImageToPetDefinition(+id, rel);

      return {
        path: rel,
        thumbnails: { small: smallRel, medium: mediumRel },
      };
    } catch (err) {
      console.warn('Thumbnail generation failed for pet:', {
        error: String(err),
        file: String(file?.filename),
      });
      // Still add image to pet definition
      try {
        await this.petService.addImageToPetDefinition(+id, rel);
      } catch (updateErr) {
        console.warn('Failed to update pet definition:', {
          id,
          error: String(updateErr),
        });
      }
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('pets/banners/:id')
  @UseInterceptors(
    FileInterceptor('banner', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const bannersDir = join(process.cwd(), 'assets', 'pets', 'banners');
          if (!fs.existsSync(bannersDir)) {
            fs.mkdirSync(bannersDir, { recursive: true });
          }
          cb(null, bannersDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `banner_${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadPetBannerImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const rel = `/assets/pets/banners/${file.filename}`;

    try {
      // Update banner image in database
      await this.petService.updateBannerImage(+id, rel);
      return { path: rel };
    } catch (err) {
      console.warn('Failed to update pet banner:', {
        id,
        error: String(err),
      });
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('pets/equipment/:id')
  @UseInterceptors(
    FileInterceptor('icon', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const equipmentDir = join(
            process.cwd(),
            'assets',
            'pets',
            'equipment',
          );
          if (!fs.existsSync(equipmentDir)) {
            fs.mkdirSync(equipmentDir, { recursive: true });
          }
          cb(null, equipmentDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `equipment_${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadPetEquipmentIcon(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const rel = `/assets/pets/equipment/${file.filename}`;
    const originalPath = file.path;
    const thumbsDir = join(
      process.cwd(),
      'assets',
      'pets',
      'equipment',
      'thumbs',
    );

    if (!fs.existsSync(thumbsDir)) {
      fs.mkdirSync(thumbsDir, { recursive: true });
    }

    try {
      const { name } = parse(file.filename);
      const iconName = `${name}_64.webp`;

      const sharpModule = await import('sharp');
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;

      if (typeof sharpLibAny !== 'function') {
        console.warn('Sharp import did not return a callable function');
        await this.petService.updateEquipmentIcon(id, rel);
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;

      // Generate icon-sized thumbnail (64x64)
      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, iconName));

      const iconRel = `/assets/pets/equipment/thumbs/${iconName}`;

      // Update equipment icon in database
      await this.petService.updateEquipmentIcon(id, iconRel);

      return {
        path: rel,
        icon: iconRel,
      };
    } catch (err) {
      console.warn('Icon generation failed for pet equipment:', {
        error: String(err),
        file: String(file?.filename),
      });
      try {
        await this.petService.updateEquipmentIcon(id, rel);
      } catch (updateErr) {
        console.warn('Failed to update pet equipment:', {
          id,
          error: String(updateErr),
        });
      }
      return { path: rel };
    }
  }

  // Editor / Story image uploads (used by admin TipTap toolbar)
  @UseGuards(JwtAuthGuard)
  @Post('story')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const storyDir = join(process.cwd(), 'assets', 'story');
          if (!fs.existsSync(storyDir))
            fs.mkdirSync(storyDir, { recursive: true });
          cb(null, storyDir);
        },
        filename: (req, file, cb) => {
          const original = String((file && file.originalname) || '');
          cb(null, `${randomUUID()}${extname(original)}`);
        },
      }),
    }),
  )
  async uploadStoryImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rel = `/assets/story/${file.filename}`;
    const originalPath = file.path;
    const thumbsDir = join(process.cwd(), 'assets', 'story', 'thumbs');

    if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

    try {
      const { name } = parse(file.filename);
      const smallName = `${name}_64.webp`;
      const mediumName = `${name}_256.webp`;

      const sharpModule = await import('sharp');
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;
      if (typeof sharpLibAny !== 'function') {
        console.warn(
          'Sharp import did not return a callable function for story upload',
        );
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
      );
      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected for story but AVIF input not supported by sharp build',
          { file: originalPath },
        );
        return {
          path: rel,
          warning: 'AVIF not supported by server; thumbnails not generated',
        };
      }

      try {
        const meta = await sharpInstance(originalPath).metadata();
        const isAnimated = !!(
          (meta &&
            ((meta.pages && meta.pages > 1) ||
              (meta.frames && meta.frames > 1))) ||
          false
        );
        if (isAnimated) {
          try {
            const origExt = parse(file.filename).ext || '';
            const smallOrigName = `${name}_64${origExt}`;
            const mediumOrigName = `${name}_256${origExt}`;
            fs.copyFileSync(originalPath, join(thumbsDir, smallOrigName));
            fs.copyFileSync(originalPath, join(thumbsDir, mediumOrigName));
            const smallRel = `/assets/story/thumbs/${smallOrigName}`;
            const mediumRel = `/assets/story/thumbs/${mediumOrigName}`;
            return {
              path: rel,
              thumbnails: { small: smallRel, medium: mediumRel },
              warning: 'Animated image preserved without resizing',
            };
          } catch (copyErr) {
            console.warn('Failed to copy animated story file into thumbs:', {
              error: String(copyErr),
            });
          }
        }
      } catch (mErr) {
        console.warn('Failed to read metadata for story thumbnail decision:', {
          error: String(mErr),
        });
      }

      await sharpInstance(originalPath)
        .resize(64, 64, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, smallName));
      await sharpInstance(originalPath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(join(thumbsDir, mediumName));
      const smallRel = `/assets/story/thumbs/${smallName}`;
      const mediumRel = `/assets/story/thumbs/${mediumName}`;

      return { path: rel, thumbnails: { small: smallRel, medium: mediumRel } };
    } catch (err) {
      console.warn('Thumbnail generation failed for story upload:', {
        error: String(err),
        file: String(file?.filename),
      });
      return { path: rel };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('casino/scratch-cards/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_BYTES },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const casinoDir = join(
            process.cwd(),
            'assets',
            'casino',
            'scratch-cards',
          );
          if (!fs.existsSync(casinoDir)) {
            fs.mkdirSync(casinoDir, { recursive: true });
          }
          cb(null, casinoDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadScratchCardImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const rel = `/assets/casino/scratch-cards/${file.filename}`;
    const originalPath = file.path;

    try {
      // For scratch card backgrounds (landscape images), we'll resize to fit within 800x600
      // while maintaining aspect ratio, without cropping
      const sharpModule = await import('sharp');
      const sharpLibAny: any = (sharpModule &&
        (sharpModule.default ?? sharpModule)) as any;

      if (typeof sharpLibAny !== 'function') {
        console.warn(
          'Sharp import did not return a callable function for scratch card upload',
        );
        // Update card type even if thumbnail generation fails
        await this.scratchCardService.updateCardTypeBackgroundImage(+id, rel);
        return { path: rel };
      }

      const sharpInstance = sharpLibAny;
      const ext = String(file && file.filename).toLowerCase();
      const avifSupported = Boolean(
        (sharpInstance.format &&
          sharpInstance.format.avif &&
          sharpInstance.format.avif.input) ||
          (sharpInstance.format &&
            sharpInstance.format.heif &&
            sharpInstance.format.heif.input),
      );

      if (ext.endsWith('.avif') && !avifSupported) {
        console.warn(
          'AVIF upload detected for scratch card but AVIF input not supported by sharp build',
          { file: originalPath },
        );
        await this.scratchCardService.updateCardTypeBackgroundImage(+id, rel);
        return {
          path: rel,
          warning: 'AVIF not supported by server; image not optimized',
        };
      }

      // Get image metadata to check if it's landscape
      const metadata = await sharpInstance(originalPath).metadata();
      const isLandscape = metadata.width > metadata.height;

      let finalPath = originalPath;
      let finalRel = rel;

      if (isLandscape) {
        // For landscape images, resize to fit within 800px width, maintain aspect ratio
        const webpFilename = file.filename.replace(
          extname(file.filename),
          '.webp',
        );
        const webpPath = join(
          process.cwd(),
          'assets',
          'casino',
          'scratch-cards',
          webpFilename,
        );
        finalPath = webpPath;
        finalRel = `/assets/casino/scratch-cards/${webpFilename}`;

        await sharpInstance(originalPath)
          .resize(800, null, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toFile(webpPath);

        // Remove original file
        fs.unlinkSync(originalPath);
      } else {
        // For portrait/square images, resize to fit within 600px height
        const webpFilename = file.filename.replace(
          extname(file.filename),
          '.webp',
        );
        const webpPath = join(
          process.cwd(),
          'assets',
          'casino',
          'scratch-cards',
          webpFilename,
        );
        finalPath = webpPath;
        finalRel = `/assets/casino/scratch-cards/${webpFilename}`;

        await sharpInstance(originalPath)
          .resize(null, 600, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toFile(webpPath);

        // Remove original file
        fs.unlinkSync(originalPath);
      }

      // Update card type with final image path
      await this.scratchCardService.updateCardTypeBackgroundImage(
        +id,
        finalRel,
      );

      return {
        path: finalRel,
        note: isLandscape
          ? 'Landscape image optimized for scratch cards'
          : 'Portrait/square image optimized for scratch cards',
      };
    } catch (err) {
      console.warn('Image optimization failed for scratch card:', {
        error: String(err),
        file: String(file?.filename),
      });
      // Still update card type with original image
      try {
        await this.scratchCardService.updateCardTypeBackgroundImage(+id, rel);
      } catch (updateErr) {
        console.warn('Failed to update scratch card type:', {
          id,
          error: String(updateErr),
        });
      }
      return { path: rel };
    }
  }
}

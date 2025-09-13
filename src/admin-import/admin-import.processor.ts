import * as fs from 'fs';
const csv: any = require('fast-csv');
import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as os from 'os';
import handlers from './admin-import.handlers';

const logger = new Logger('AdminImportProcessor');

export async function processImportJob(job: { id?: string; data: any }) {
  const { data } = job as any;
  const { filePath, resource } = data;
  if (!filePath || !fs.existsSync(filePath)) {
    logger.error(`Import job ${job.id}: file not found ${filePath}`);
    return { success: false, message: 'file not found' };
  }
  // Detect common encoding issues (PowerShell echo may create UTF-16 LE files)
  let parsedFilePath = filePath;
  try {
    const raw = fs.readFileSync(filePath);
    // Check BOM for UTF-16 LE/BE
    if (raw.length >= 2) {
      const b0 = raw[0];
      const b1 = raw[1];
      // UTF-16 LE BOM 0xFF 0xFE, UTF-16 BE BOM 0xFE 0xFF
      if ((b0 === 0xff && b1 === 0xfe) || (b0 === 0xfe && b1 === 0xff)) {
        logger.log(
          `Import job ${job.id}: detected UTF-16 BOM, converting to UTF-8`,
        );
        let text: string;
        if (b0 === 0xff && b1 === 0xfe) {
          text = raw.toString('utf16le');
        } else {
          // UTF-16 BE: swap bytes to convert to LE then decode
          const swapped = Buffer.allocUnsafe(raw.length);
          for (let i = 0; i < raw.length; i += 2) {
            const a = raw[i];
            const b = raw[i + 1];
            swapped[i] = b;
            swapped[i + 1] = a;
          }
          text = swapped.toString('utf16le');
        }
        const out = path.resolve(
          process.cwd(),
          'tmp',
          `converted-${path.basename(filePath)}`,
        );
        fs.writeFileSync(out, text, { encoding: 'utf8' });
        parsedFilePath = out;
      } else {
        // Heuristic: many null bytes -> likely UTF-16LE without BOM
        const sampleLen = Math.min(raw.length, 2000);
        let zeroCount = 0;
        for (let i = 0; i < sampleLen; i++) {
          if (raw[i] === 0) zeroCount++;
        }
        if (zeroCount > sampleLen / 4) {
          logger.log(
            `Import job ${job.id}: detected many null bytes (${zeroCount}/${sampleLen}), assuming utf16le and converting to UTF-8`,
          );
          const text = raw.toString('utf16le');
          const out = path.resolve(
            process.cwd(),
            'tmp',
            `converted-${path.basename(filePath)}`,
          );
          fs.writeFileSync(out, text, { encoding: 'utf8' });
          parsedFilePath = out;
        }
      }
    }
  } catch (e) {
    // If conversion detection fails, proceed with original filePath and let CSV parser surface errors
    logger.warn(
      `Import job ${job.id}: encoding detection failed: ${String(e)}`,
    );
  }

  // Normalize header line: strip embedded nulls and other control characters that
  // can appear when CSVs are saved as UTF-16 / created by PowerShell/Excel.
  try {
    const text = fs.readFileSync(parsedFilePath, { encoding: 'utf8' });
    const idx = text.indexOf('\n');
    if (idx > 0) {
      const headerLine = text.slice(0, idx).replace(/\r$/, '');
      const rest = text.slice(idx + 1);
      // remove explicit NUL chars and other non-printable control chars (except tab)
      const cleanedHeader = headerLine
        .replace(/\u0000/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
      if (cleanedHeader !== headerLine) {
        const out = path.resolve(
          process.cwd(),
          'tmp',
          `normalized-${path.basename(parsedFilePath)}`,
        );
        fs.writeFileSync(out, cleanedHeader + os.EOL + rest, {
          encoding: 'utf8',
        });
        parsedFilePath = out;
        logger.log(`Import job ${job.id}: normalized CSV header, wrote ${out}`);
      }
    }
  } catch (e) {
    logger.warn(
      `Import job ${job.id}: header normalization failed: ${String(e)}`,
    );
  }

  // Detect delimiter (tab vs comma) by inspecting the first line header
  let delimiter: string = ',';
  try {
    const firstLine = fs.readFileSync(parsedFilePath, { encoding: 'utf8' }).split(/\r?\n/)[0] || '';
    // If header contains tabs and no commas, treat as TSV
    if (firstLine.includes('\t') && !firstLine.includes(',')) {
      delimiter = '\t';
      logger.log(`Import job ${job.id}: detected tab-delimited (TSV) file`);
    }
  } catch (e) {
    logger.warn(`Import job ${job.id}: delimiter detection failed: ${String(e)}`);
  }

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(parsedFilePath);
    const rows: any[] = [];
    let rowCount = 0;

    const parser = csv
      .parse({ headers: true, trim: true, delimiter })
      .on('error', (err: Error) => {
        logger.error(`CSV parse error for job ${job.id}: ${err.message}`);
        reject(err);
      })
      .on('data', (row: any) => {
        rowCount += 1;
        rows.push(row);
        if (rowCount % 200 === 0) {
          logger.debug(`job ${job.id}: parsed ${rowCount} rows`);
        }
      })
      .on('end', async () => {
        logger.log(
          `Import job ${job.id} finished parsing ${rowCount} rows for resource ${resource}`,
        );
        try {
          let result: any = null;
          if (resource === 'items') {
            result = await handlers.processItems(rows);
          } else if (resource === 'monsters') {
            result = await handlers.processMonsters(rows);
          } else if (resource === 'quests') {
            result = await handlers.processQuests(rows);
          } else if (resource === 'dungeons') {
            result = await handlers.processDungeons(rows);
          } else if (resource === 'levels') {
            result = await handlers.processLevels(rows);
          } else if (resource === 'character-classes') {
            result = await handlers.processCharacterClasses(rows);
          } else {
            result = {
              success: false,
              message: `unknown resource ${resource}`,
            };
          }

          // If there are parseErrors, write them to an errors csv for admin to download
          if (result?.parseErrors && result.parseErrors.length > 0) {
            const errFile = path.resolve(
              process.cwd(),
              'tmp',
              `import-errors-${job.id}.csv`,
            );
            const ws = fs.createWriteStream(errFile, { encoding: 'utf8' });
            const csvWrite = csv.format({ headers: true });
            csvWrite.pipe(ws);
            for (const e of result.parseErrors) {
              csvWrite.write({
                row: e.row,
                error: e.error,
                raw: JSON.stringify(e.raw),
              });
            }
            csvWrite.end();
            result.errorFile = errFile;
          }

          resolve({ success: true, parsed: rowCount, result });
        } catch (e) {
          logger.error('Error processing rows', e as any);
          reject(e);
        }
      });

    stream.pipe(parser);
  });
}

module.exports = { processImportJob };

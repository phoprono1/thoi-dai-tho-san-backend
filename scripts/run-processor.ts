import { processImportJob } from '../src/admin-import/admin-import.processor';

async function run() {
  try {
    const res = await processImportJob({ id: 'test-run', data: { filePath: process.cwd() + '/tmp/test-monsters.csv', resource: 'monsters' } });
    console.log('Processor result:', res);
  } catch (e) {
    console.error('Processor threw', e);
  }
}

run();

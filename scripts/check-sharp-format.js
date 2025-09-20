(async () => {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default ?? sharpModule;
    console.log('sharp is function?', typeof sharp === 'function');
    // print supported input/output formats
    // @ts-ignore
    console.log('input formats:', sharp.format);
  } catch (err) {
    console.error('Error importing sharp:', err);
    process.exit(2);
  }
})();

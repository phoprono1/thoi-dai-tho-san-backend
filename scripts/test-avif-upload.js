(async () => {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default ?? sharpModule;
    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.join(process.cwd(), 'assets', 'test-avif');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const originalPng = path.join(outDir, 'orig.png');
    const avifPath = path.join(outDir, 'sample.avif');
    const thumb64 = path.join(outDir, 'sample_64.webp');
    const thumb256 = path.join(outDir, 'sample_256.webp');
    // Create a test PNG then encode to avif to simulate upload
    await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 30, g: 144, b: 255, alpha: 1 } } })
      .png()
      .toFile(originalPng);
    console.log('Created', originalPng);
    // Encode to avif
    if (sharp.format && sharp.format.avif && sharp.format.avif.output) {
      await sharp(originalPng).avif({ quality: 50 }).toFile(avifPath);
      console.log('Created AVIF', avifPath);
    } else {
      console.warn('AVIF output not supported by this sharp build; skipping AVIF encode and testing from PNG');
      // copy original to avifPath with png extension to test processing path
      await sharp(originalPng).toFile(avifPath.replace('.avif', '.png'));
    }
    // Now simulate controller processing: read avif (or png) and generate webp thumbnails
    const inputPath = fs.existsSync(avifPath) ? avifPath : originalPng;
    console.log('Processing input:', inputPath);
    await sharp(inputPath).resize(64, 64, { fit: 'cover' }).webp({ quality: 80 }).toFile(thumb64);
    await sharp(inputPath).resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).toFile(thumb256);
    console.log('Generated thumbs:', thumb64, thumb256);
  } catch (err) {
    console.error('Test AVIF upload failed:', err);
    process.exit(2);
  }
})();


// Konversi base64 PNG ke ESC/POS raster image command (browser version)
export async function pngBase64ToEscposRaster(base64: string): Promise<Uint8Array> {
  // Buat image dari base64
  const img = new Image();
  img.src = 'data:image/png;base64,' + base64;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  // Draw ke canvas
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const width = img.width;
  const height = img.height;
  const bytesPerRow = Math.ceil(width / 8);
  const raster = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const grayscale = (r + g + b) / 3;
      if (grayscale < 128) {
        raster[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x % 8));
      }
    }
  }

  // ESC/POS command: GS v 0
  const header = new Uint8Array([
    0x1D, 0x76, 0x30, 0x00,
    bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
    height & 0xFF, (height >> 8) & 0xFF
  ]);
  const result = new Uint8Array(header.length + raster.length);
  result.set(header, 0);
  result.set(raster, header.length);
  return result;
}
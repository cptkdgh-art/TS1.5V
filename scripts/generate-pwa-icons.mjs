import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const source = await readFile(path.join(publicDir, 'jinpok-icon.svg'));
const outputs = [
  ['favicon-v2-32x32.png', 32],
  ['apple-touch-icon-v2.png', 180],
  ['pwa-v2-192x192.png', 192],
  ['pwa-v2-512x512.png', 512],
  ['pwa-maskable-v2-512x512.png', 512],
];

await Promise.all(outputs.map(([filename, size]) => (
  sharp(source)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, filename))
)));

console.log(`Generated ${outputs.length} PWA icons in ${publicDir}`);

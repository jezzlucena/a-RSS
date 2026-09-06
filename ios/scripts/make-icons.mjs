// Renders the three iOS 26 app-icon variants (light / dark / tinted) from the web logo.
// Needs `sharp`: run from a directory where it's installed, e.g.
//   cd <scratch-with-sharp> && node /path/to/ios/scripts/make-icons.mjs /path/to/repo
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const sharp = createRequire(path.join(process.cwd(), 'package.json'))('sharp');
const repo = process.argv[2] ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const svg = readFileSync(path.join(repo, 'apps/web/public/logo.svg'), 'utf8');
const outDir = path.join(repo, 'ios/aRSS/Assets.xcassets/AppIcon.appiconset');

// iOS masks icons itself, so every variant is a full-bleed square (no rx/ry).
const squareTile = svg.replace('<rect class="st1" width="180" height="180" rx="36" ry="36"/>', '<rect class="st1" width="180" height="180"/>');
const variants = {
  // Red tile, white glyph — the brand mark as-is.
  'icon-light.png': squareTile,
  // Dark paper tile, dark-mode vermilion glyph (matches the web dark palette).
  'icon-dark.png': squareTile.replace('fill: #fff;', 'fill: #e2543a;').replace('fill: #c9412b;', 'fill: #171510;').replace('stroke: #fff;', 'stroke: #e2543a;'),
  // Tinted: glyph only on transparent; iOS applies the user's tint.
  'icon-tinted.png': svg.replace(/<rect class="st1"[^>]*\/>/, ''),
};

for (const [name, source] of Object.entries(variants)) {
  await sharp(Buffer.from(source), { density: 600 }).resize(1024, 1024).png().toFile(path.join(outDir, name));
  console.log('wrote', name);
}

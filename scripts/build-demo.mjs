import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const output = new URL('site/', root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('outputs/', output), { recursive: true });
for (const [source, destination] of [
  ['demo/index.html', 'index.html'],
  ['demo/widescreen.html', 'widescreen.html'],
  ['outputs/dragon-feature-tour-widescreen.mp4', 'outputs/dragon-feature-tour-widescreen.mp4'],
  ['outputs/dragon-poster-widescreen.jpg', 'outputs/dragon-poster-widescreen.jpg'],
  ['outputs/dragon-feature-tour.mp4', 'outputs/dragon-feature-tour.mp4'],
  ['outputs/dragon-poster.jpg', 'outputs/dragon-poster.jpg'],
]) await copyFile(new URL(source, root), new URL(destination, output));
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built video-only demo: ${fileURLToPath(output)}`);

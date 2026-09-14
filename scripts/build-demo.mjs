import { copyFile, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const output = new URL('site/', root);
// Fail closed: Vite copies public/ verbatim. Only the licensed prepared model
// may enter a Pages build, even if someone has legacy private assets locally.
const allowed = new Set([
  'models/elder-fire/dragon.json', 'models/elder-fire/LICENSE.md',
  ...['head', 'shoulders-wings', 'torso', 'hind-legs', 'tail-base', 'tail-middle', 'tail-tip']
    .map(name => `models/elder-fire/${name}.stl`),
]);
async function checkPublic(directory, prefix = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + item.name;
    if (item.isDirectory()) await checkPublic(new URL(item.name + '/', directory), path + '/');
    else if (!item.isFile() || !allowed.delete(path)) throw new Error(`Unapproved public asset: ${path}`);
  }
}
await checkPublic(new URL('public/', root));
if (allowed.size) throw new Error(`Missing public assets: ${[...allowed].join(', ')}`);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: root, stdio: 'inherit' });
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
await cp(new URL('dist/', root), new URL('play/', output), { recursive: true });
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built playable dragon and video demos: ${fileURLToPath(output)}`);

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const output = new URL('recording-preview/', root);
const files = ['index.html', 'src/physics.js', 'src/flight-path.js', 'src/manual-flight.js', 'src/style.css',
  'public/models/elder-fire/dragon.json', 'public/models/elder-fire/LICENSE.md',
  ...['head','shoulders-wings','torso','hind-legs','tail-base','tail-middle','tail-tip'].map(name=>`public/models/elder-fire/${name}.stl`)];
for (const name of files) {
  await mkdir(new URL(name.slice(0,name.lastIndexOf('/')+1), output), {recursive:true});
  await copyFile(new URL(name,root),new URL(name,output));
}
let source = await readFile(new URL('src/main.js',root),'utf8');
const replace = (from,to) => {
  if (source.split(from).length !== 2) throw new Error(`Recording insertion needs review: ${from.slice(0,60)}`);
  source=source.replace(from,to);
};
replace('const $ =', `import { runShortTour } from './short-tour.js';
const portrait = new URLSearchParams(location.search).get('format') !== 'widescreen';
const viewWidth = portrait ? 640 : 1280, viewHeight = portrait ? 800 : 604;
const outputWidth = portrait ? 1080 : 1920, outputHeight = portrait ? 1350 : 906;
const $ =`);
source=source.replaceAll('innerWidth','viewWidth').replaceAll('innerHeight','viewHeight');
replace('renderer.setPixelRatio(Math.min(devicePixelRatio, 2));','renderer.setPixelRatio(1);');
source=source.replaceAll('renderer.setSize(viewWidth, viewHeight);','renderer.setSize(outputWidth, outputHeight, false);');
replace('  const homeTarget =', '  if (portrait) camera.setViewOffset(920,1150,-80,-160,1080,1350);\n  const homeTarget =');
replace('viewWidth < 700 ? 0 : -2.3, 0.5, 0','viewWidth < 700 ? 0 : -2.3, portrait ? 1.8 : 0.5, 0');
// Exported frames have a fixed clock. Tab visibility must not alter their timing.
source=source.replaceAll('document.hidden','false');
replace('  renderer.setAnimationLoop(animate);', `
  let recordingClock = last;
  const advance = () => animate(recordingClock += 1000 / 30);
  const clearInput = () => keys.clear();
  const changeMaterial = name => { $('finish').value=name; $('finish').dispatchEvent(new Event('change')); };
  const resetForCut = () => { reset(); for(let i=0;i<24;i++) advance(); };
  let grabOrigin;
  await runShortTour({
    portrait, width:outputWidth, height:outputHeight, renderer, sim, camera, controls, homeTarget,
    advance, clearInput, changeMaterial, resetForCut,
    input(key) { keys.clear(); if(key) steer(key); },
    fly() { $('fly').click(); },
    beginGrab() {
      setGrabMode(true);
      controls.target.copy(homeTarget).add(new THREE.Vector3(0,portrait ? 3.8 : 1.5,0));
      camera.position.set(6,12,20).setLength(portrait ? 39 : 33).add(controls.target);
      controls.update();
      grabOrigin=new THREE.Vector3().copy(sim.bodies[2].getPosition());
      grabOrigin.y += manifest.parts[2].bounds[1][1]*.6;
      sim.beginGrab(2,grabOrigin);
      grabPointer=-1; selectedMesh=meshes[2]; updateGrabMaterial(); selectedMesh.material=grabMaterial;
      controls.enabled=false; updateButtons();
    },
    moveGrab(offset,amount) {
      sim.moveGrab(grabOrigin.clone().add(offset));
      controls.target.copy(homeTarget).add(new THREE.Vector3(0,(portrait ? 3.8 : 1.5)+amount*2.8,0));
      const p=sim.bodies[2].getPosition(); controls.target.x+=p.x*amount;controls.target.z+=p.z*amount;
      camera.position.set(6,12,20).setLength((portrait ? 39 : 33)+amount*7).add(controls.target);
    },
    release() { releaseGrab(); setGrabMode(false); },
    status() { return { mode:$('mode-label').textContent, material:$('finish').value, key:[...keys][0], held:!!sim.grab }; },
  });
`);
await writeFile(new URL('src/main.js',output),source);
await copyFile(new URL('work/recording/short-tour.js',root),new URL('src/short-tour.js',output));
console.log('Prepared recording-preview from the current app and licensed assets.');

import { mkdirSync, writeFileSync } from "node:fs";
import { Quaternion, Vector3 } from "three";
import { createFlightPath } from "../src/flight-path.js";

// Sample the real target controller; this illustration needs no dragon mesh.
const controller = createFlightPath(new Vector3(0, 7, 0), new Quaternion());
const samples = [];
for (let frame = 0; frame < 24 * 60; frame++) {
  const state = controller.step(1 / 60);
  if (frame % 3 === 0)
    samples.push({ time: (frame + 1) / 60, ...state.position });
}
const bounds = (key) => [
  Math.min(...samples.map((p) => p[key])),
  Math.max(...samples.map((p) => p[key])),
];
const [x0, x1] = bounds("x");
const [z0, z1] = bounds("z");
const fit = 290 / Math.max(x1 - x0, z1 - z0);
const project = (p) => [
  225 + (p.x - (x0 + x1) / 2) * fit,
  260 - (p.z - (z0 + z1) / 2) * fit,
];
const path = (points) => points.map(([x, y], i) =>
  `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`,
).join(" ");
const top = path(samples.map(project));
const altitude = path(samples.map((p) => [505 + p.time / 24 * 360, 408 - p.y / 14 * 275]));
const [sx, sy] = project(samples[0]);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520" viewBox="0 0 960 520" role="img" aria-labelledby="title desc">
<title id="title">The dragon's head target: circuit and altitude</title>
<desc id="desc">Twenty-four seconds sampled from the flight controller. A looping horizontal circuit pairs low swoops with climbing turns. This shows the target, not the physical dragon's trajectory.</desc>
<rect width="960" height="520" rx="20" fill="#eae7df"/>
<g font-family="system-ui, sans-serif" fill="#213e31">
<text x="48" y="53" font-size="24" font-weight="650">Let the head lead</text>
<text x="48" y="82" font-size="14" fill="#58685d">Catmull–Rom flight target · 24 seconds · sampled from the controller</text>
<text x="68" y="127" font-size="15" font-weight="600">Circuit · top view</text>
<text x="505" y="127" font-size="15" font-weight="600">Altitude over time</text>
<path d="M505 133V408H875" fill="none" stroke="#a6afa4"/>
${[0, 4, 8, 12].map((y) => `<path d="M505 ${408-y/14*275}H865" stroke="#cbd0c4"/><text x="492" y="${413-y/14*275}" text-anchor="end" font-size="12">${y}</text>`).join("")}
${[0, 6, 12, 18, 24].map((t) => `<text x="${505+t/24*360}" y="431" text-anchor="middle" font-size="12">${t}s</text>`).join("")}
<path d="${top}" fill="none" stroke="#377d60" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="${sx}" cy="${sy}" r="6" fill="#b56d43" stroke="#eae7df" stroke-width="2"/>
<text x="${sx+12}" y="${sy+5}" font-size="12">Start</text>
<path d="${altitude}" fill="none" stroke="#377d60" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<text x="48" y="482" font-size="13" fill="#58685d">The head follows a force target. Joints, springs and inertia carry the body and tail behind it.</text>
</g></svg>\n`;
mkdirSync(new URL("../outputs/", import.meta.url), { recursive: true });
writeFileSync(new URL("../outputs/flight-path.svg", import.meta.url), svg);
console.log("Wrote outputs/flight-path.svg");

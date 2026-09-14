import { mkdirSync, writeFileSync } from "node:fs";
import { Quaternion, Vector3 } from "three";
import { createFlightPath } from "../src/flight-path.js";

// Sample one full sequence from the real head-target controller.
const controller = createFlightPath(new Vector3(0, 12, 0), new Quaternion());
const samples = [];
for (let frame = 0; frame < 180 * 60; frame++) {
  const state = controller.step(1 / 60);
  if (frame % 3 === 0 || state.cycle > 0)
    samples.push({ time: (frame + 1) / 60, leg: state.cycle > 0 ? 3 : state.legIndex, ...state.position });
  if (state.cycle > 0) break;
}
const duration = samples.at(-1).time;
const path = points => points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
const colors = ["#377d60", "#a6603b", "#466e99", "#7b6189"];
const labels = ["1 · Circle", "2 · Figure eight", "3 · Reverse circle", "4 · Figure eight"];
const topViews = labels.map((label, leg) => {
  const points = samples.filter(p => p.leg === leg);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
  const scale = 185 / Math.max(maxX - minX, maxZ - minZ);
  const project = p => [143 + leg * 238 + (p.x - (minX + maxX) / 2) * scale, 265 - (p.z - (minZ + maxZ) / 2) * scale];
  const [x, y] = project(points[0]);
  const arrows = [0.23, 0.7].map(fraction => {
    const i = Math.floor(points.length * fraction);
    const [ax, ay] = project(points[i]), [bx, by] = project(points[i + 1]);
    const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    return `<path d="M-7 -4L2 0L-7 4" fill="none" stroke="${colors[leg]}" stroke-width="2.5" transform="translate(${ax} ${ay}) rotate(${angle})"/>`;
  }).join("");
  return `<text x="${48 + leg * 238}" y="137" font-size="16" font-weight="600">${label}</text>
<path d="${path(points.map(project))}" fill="none" stroke="${colors[leg]}" stroke-width="3" stroke-linecap="round"/>
<circle cx="${x}" cy="${y}" r="4" fill="${colors[leg]}"/>${arrows}`;
}).join("");
const altitude = colors.map((color, leg) => `<path d="${path(samples.filter(p => p.leg === leg).map(p => [75 + p.time / duration * 850, 590 - p.y / 20 * 160]))}" fill="none" stroke="${color}" stroke-width="3"/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680" viewBox="0 0 1000 680" role="img" aria-labelledby="title desc">
<title id="title">The dragon's repeating four-pattern flight route</title>
<desc id="desc">A circle, figure eight, opposite circle, and mirrored figure eight repeat. Low passes rise to about eight metres and peaks to eighteen. Arrows show direction; an altitude chart covers the complete sequence. This is the head target, not the physical dragon's trajectory.</desc>
<rect width="1000" height="680" rx="20" fill="#eae7df"/>
<g font-family="system-ui, sans-serif" fill="#213e31">
<text x="48" y="53" font-size="24" font-weight="650">Let the head lead</text>
<text x="48" y="82" font-size="14" fill="#58685d">Four Catmull–Rom patterns · ${duration.toFixed(1)} seconds including entry · then repeat</text>
${topViews}
<text x="48" y="406" font-size="15" font-weight="600">Head-target altitude · metres</text>
${[0, 5, 10, 15, 20].map(y => `<path d="M75 ${590-y/20*160}H925" stroke="#cbd0c4"/><text x="61" y="${595-y/20*160}" text-anchor="end" font-size="12">${y}</text>`).join("")}
${[0, 10, 20, 30, 40, 50, 60].map(t => `<text x="${75+t/duration*850}" y="615" text-anchor="middle" font-size="12">${t}s</text>`).join("")}
${altitude}
<text x="48" y="653" font-size="13" fill="#58685d">The head follows the target. Joints and inertia carry the body and tail; the camera keeps its viewing angle.</text>
</g></svg>\n`;
mkdirSync(new URL("../outputs/", import.meta.url), { recursive: true });
writeFileSync(new URL("../outputs/flight-path.svg", import.meta.url), svg);
console.log("Wrote outputs/flight-path.svg");

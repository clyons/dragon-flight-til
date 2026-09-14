# Dragon: Flight Playground

A Three.js playground that brings an articulated print model to life with Box3D physics. Steer the dragon through climbing turns and low swoops, watch the tail trail behind, or grab a section and give it a shake.

[![Watch the dragon climb into a turn in the widescreen demo](outputs/dragon-poster-widescreen.jpg?v=flight)](https://clyons.github.io/dragon-flight-til/widescreen.html)

**[Watch the widescreen demo](https://clyons.github.io/dragon-flight-til/widescreen.html)** · [Portrait version](https://clyons.github.io/dragon-flight-til/) · [Download the widescreen MP4](outputs/dragon-feature-tour-widescreen.mp4) · [Video chapters and recording method](docs/demo.md)

The public page is a 31.4-second recorded tour: head-led flight, manual steering, a quick grab and shake, a throw and floor bump, Copper and Obsidian, then reset. Anyone can watch it without a model download or installation. The widescreen video is 1920 × 906; the portrait edit is 1080 × 1350 (4:5). Both are 30 fps, with captions and no audio. The interactive source below runs locally with separately obtained model assets.

[Read the TIL: Teaching a printed dragon to fly](https://ciaranlyons.com/til/2026/09/13/teaching-a-printed-dragon-to-fly/)

[How it works](docs/how-it-works.md) · [Reproduce it](docs/reproduction.md) · [Attribution](docs/attribution.md)

## Run locally

Requires Node.js 22.12 or later and a browser with WebGL2 and WebAssembly SIMD. Python 3.12 or later is used for asset preparation.

The model is a separate download. This repository does **not** redistribute the original STL, derived part meshes, or collision manifest. Follow the [model preparation steps](docs/reproduction.md#prepare-the-model) before starting the app or running the physics tests.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To build and check the static site:

```sh
npm test
npm run build
npm run preview
```

## Controls

| Action | Control |
| --- | --- |
| Rotate view | Drag |
| Zoom | Scroll or pinch |
| Take off / release lift | Take flight / Drop |
| Toggle grab | G or Grab |
| Lift, shake, or toss | Drag a section in Grab mode; release to let go |
| Steer the head | Arrow keys while flying |
| Resume autopilot | Wait five seconds without steering, or click the countdown |
| Pause / resume | Space |
| Reset with a dissolve | R |
| Toggle help | / or ? |

Jade, Copper, and Obsidian use different optical properties. The grabbed section highlights in its material's own colour.

## Explore the source

| File | Purpose |
| --- | --- |
| [src/main.js](src/main.js) | Rendering, materials, lighting, picking, controls, reset dissolve |
| [src/physics.js](src/physics.js) | Box3D bodies, joints, collision filtering, flight forces, grabbing |
| [src/flight-path.js](src/flight-path.js) | Catmull–Rom autopilot circuit and entry blend |
| [src/manual-flight.js](src/manual-flight.js) | Heading, pitch, banking, and expressive neck steering |
| [scripts/prepare-dragon.py](scripts/prepare-dragon.py) | Exact mesh splitting and collision proxy generation |
| [scripts/inspect-dragon.py](scripts/inspect-dragon.py) | A local component map of the downloaded model |
| [scripts/plot-flight-path.mjs](scripts/plot-flight-path.mjs) | Regenerate the route illustration without model assets |
| [tests/physics.test.mjs](tests/physics.test.mjs) | Geometry preservation and actual WASM physics regression tests |

Flight is a stylized controller, not an aerodynamic simulation. The wings and torso are one mesh and move together. Only head/foot self-collisions are enabled; the rest of the printed interlocking sections can intersect. See [implementation details and limitations](docs/how-it-works.md).

For the video-only GitHub Pages build, see [publishing](docs/publishing.md). The project does not grant a license to the third-party dragon model; see [attribution and asset rights](docs/attribution.md).

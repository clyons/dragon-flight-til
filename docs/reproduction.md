# Run and reproduce the playground

## Run locally

Use Node.js 22.12 or later (see `.nvmrc`) and a browser with WebGL2 and WebAssembly SIMD. The prepared Elder Fire model is included. Python and a separate model download are unnecessary for normal use.

```sh
npm ci
npm run dev
```

Open the HTTP URL printed by Vite. Opening `index.html` from disk will not load modules and WASM correctly.

```sh
npm test
npm run build
npm run preview
```

The 13 tests run the actual Box3D WebAssembly engine. They check asset hashes and size, complete wing grouping, joint attachment, settling, takeoff, two full autopilot cycles, pattern order and continuity, manual steering and idle handoff, symmetric neck travel, head/foot clearance, floor bumps, reset, and grabbing after distant or high flight. Browser checks additionally cover framing, materials, picking, help, and reset transitions.

Vite may warn about Box3D’s Node `module` import being externalized for browsers and about a JavaScript chunk over 500 kB. These are distinct from build failures.

## Regenerate the model

1. Download the STL from [Biocraftlab’s Elder Fire Dragon](https://www.printables.com/model/1385888-elder-fire-dragon-flexi-toy-figure). Keep the raw file outside `public/`.
2. Install the pinned preparation tools in a Python environment:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-model.txt
python scripts/prepare-elder-fire.py /path/to/elder-fire.stl
```

On Windows, activate with `.venv\Scripts\Activate.ps1`. The pinned tool versions were validated with Python 3.14.

The script requires source SHA-256 `806fe02ccc02b2fcd39822e8e42cab209b01781f5d306517b64b8ea5c04f4280`. It simplifies each of 86 shells separately, smooths body and wing ridges, assigns them to seven bodies, and exports centred meshes and contact proxies to `public/models/elder-fire/`. The default budget produces 120,106 triangles in 6,005,888 bytes of STL geometry. The existing licence notice remains in that directory. A different source revision needs its grouping reviewed; do not bypass the hash guard.

The source and adaptation are [CC BY-NC-SA 4.0](../public/models/elder-fire/LICENSE.md). Preserve the attribution and identify further changes. After regenerating, run the tests and inspect the moving model: numerical stability alone does not prove decorative parts are grouped correctly.

## Other reproduction tools

`node scripts/plot-flight-path.mjs` regenerates `outputs/flight-path.svg` without loading a model.

`prepare-dragon.py`, `inspect-dragon.py`, and `requirements.txt` are retained as historical preparation tools for the original video model. They do not produce the assets loaded by the current playground. The original model is not redistributed; see [attribution](attribution.md).

To build both video players and the interactive page, use [the Pages build instructions](publishing.md).

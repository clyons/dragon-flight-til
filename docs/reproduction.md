# Reproduce the experiment

## Install tools

Use Node.js 22.12 or later (the repository's `.nvmrc` selects Node 22) and Python 3.12 or later. The JavaScript lockfile pins Three.js, Box3D's WASM wrapper, and Vite. Python dependencies are pinned in [requirements.txt](../requirements.txt).

```sh
npm ci
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

On Windows, activate the environment with `.venv\Scripts\Activate.ps1` in PowerShell.

## Prepare the model

1. Visit the [original MakerWorld model and print profile](https://makerworld.com/en/models/2735519-articulated-dragon#profileId-3032774). Check its creator's current download and usage terms.
2. Obtain the original `danger+dragon.stl` from that source. Rename your local copy to `dragon.stl` and place it in `public/models/` (create those directories if needed).
3. Run the preparation script from the repository root:

```sh
python scripts/prepare-dragon.py
```

The expected source SHA-256 is:

```text
a441932338aadf2a15c81594f29e08bb5261bd9d2dcd1f70320ef65fb203c4db
```

The expected result is 61,096 preserved triangles in seven rigid sections. The script generates `part-0.stl` through `part-6.stl` and `dragon.json` beside the source. The test suite checks the source hash and compares the exported triangles. A different revision or exported format may not match this model-specific preparation; do not bypass the tests to assume it is equivalent.

Model assets are ignored by Git. Do not commit them unless you have established redistribution permission and updated the attribution notice.

## Run and verify

```sh
npm run dev
```

Use the HTTP URL printed by Vite; opening `index.html` directly from disk will not load the modules and WASM correctly.

```sh
npm test
npm run build
npm run preview
```

The 11 regression tests use the actual Box3D WebAssembly engine. They cover triangle preservation, joint attachment, settling, takeoff, long autopilot flight, manual steering and idle handoff, left/right and upward neck travel, head/foot clearance, floor bumps, reset, and grabbing after distant or high flight. These tests require the locally prepared model. A build alone cannot prove the model is available at runtime.

Vite may warn about Box3D's Node `module` import being externalized for browsers and about a JavaScript chunk over 500 kB. These warnings are distinct from build failures.

For a manual smoke check: take off, steer in both directions and upward, wait five seconds for autopilot, dive into the floor, grab and release a section, change all three materials, toggle help with both keys, and reset with both the button and R. Check the dissolve and reduced-motion behaviour in a browser; physics tests do not cover rendered UI transitions.

## Regenerate the illustrations

The route illustration needs only JavaScript dependencies:

```sh
node scripts/plot-flight-path.mjs
```

It writes `outputs/flight-path.svg` from the actual flight-target controller. It does not include model geometry.

With the model prepared, create a component inspection image:

```sh
python scripts/inspect-dragon.py
```

This writes `outputs/dragon-parts.png`. The generated model illustration is kept local and ignored by Git.

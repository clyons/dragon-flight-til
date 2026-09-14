# Publish the playground and video demos

The [playable Elder Fire playground](https://clyons.github.io/dragon-flight-til/play/) includes the licensed, simplified model. The [portrait](https://clyons.github.io/dragon-flight-til/) and [widescreen](https://clyons.github.io/dragon-flight-til/widescreen.html) video pages retain their existing URLs. Source: [clyons/dragon-flight-til](https://github.com/clyons/dragon-flight-til).

## Build and preview

```sh
npm ci
npm test
npm run build:demo
python3 -m http.server 8080 --directory site
```

Open http://localhost:8080/play/ for the interactive page and http://localhost:8080/ for the portrait player. Relative Vite asset URLs work under the GitHub Pages repository path.

[build-demo.mjs](../scripts/build-demo.mjs) checks `public/` against an explicit list of seven Elder Fire STLs, their manifest and licence notice before building. Unexpected files, including locally prepared private model assets, fail the build. It then copies the generated Vite build into `site/play/` and the two existing players, videos and posters to their original locations. Raw source geometry is not included.

## GitHub Pages

[The workflow](../.github/workflows/pages.yml) installs the locked JavaScript dependencies, runs the physics tests, builds `site/`, and deploys through GitHub’s `github-pages` environment on pushes to `main` or manual runs. Pages uses **GitHub Actions** as its source.

After deployment, check the interactive model, WASM and licence from `/dragon-flight-til/play/`, exercise takeoff, steering, grabbing and reset, and verify both existing videos and posters still load. Model adaptations retain [Biocraftlab’s CC BY-NC-SA 4.0 attribution](attribution.md).

# Publish the video demo

The public page at https://clyons.github.io/dragon-flight-til/ plays the finished portrait video. It does not run the interactive simulation or serve model geometry. The source repository is https://github.com/clyons/dragon-flight-til.

## Build and preview

The demo build uses Node's standard library and requires no package installation or model files:

```sh
node scripts/build-demo.mjs
python3 -m http.server 8080 --directory site
```

Open http://localhost:8080. Check play/pause, seeking, chapter buttons, portrait sizing, and the MP4 download. The script copies only the two players, their videos and posters, and an empty `.nojekyll` marker into `site/`. It never copies `public/` or the interactive Vite build.

## GitHub Pages

[The Pages workflow](../.github/workflows/pages.yml) assembles the allowlisted `site/` directory on pushes to `main` or a manual run, then deploys it using GitHub's `github-pages` environment. Enable **Settings → Pages → GitHub Actions** for a new repository. See [GitHub's official custom-workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

After deployment, verify that the player, poster, and MP4 load from the repository subpath, that seeking returns partial content, and that model paths are absent. Keep the video and poster filenames aligned with [the player template](../demo/index.html) and [build script](../scripts/build-demo.mjs).

## Interactive hosting

`npm run build` still builds the local interactive experiment after [model preparation](reproduction.md). That `dist/` output can include private model assets from `public/`; it is not the Pages artifact. Hosting the interactive version requires a model with suitable redistribution permission and an accurate creator/license notice. Keep the video-only workflow until those requirements are met.

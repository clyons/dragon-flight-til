# Feature tour

[Play the Elder Fire playground](https://clyons.github.io/dragon-flight-til/play/) · [Watch portrait](https://clyons.github.io/dragon-flight-til/) · [Watch widescreen](https://clyons.github.io/dragon-flight-til/widescreen.html) · [Download MP4](../outputs/dragon-feature-tour.mp4)

Both editions: 34.5 seconds · H.264 · 30 fps · 1,035 frames · no audio. Portrait: 1080 × 1350 (4:5). Widescreen: 1920 × 906. The model is Biocraftlab’s Elder Fire Dragon, with the body, wings and feet smoothed; see [attribution](attribution.md).

| Time | Feature |
| --- | --- |
| 00:00 | Head-led circle, already moving from the opening frame |
| 00:04 | Figure eight |
| 00:10 | Circle in the other direction |
| 00:13 | Left, right and upward head steering |
| 00:17 | Pick up, shake and wind up |
| 00:19.7 | Throw stroke; release at 00:20.3, followed by landing |
| 00:25.3 | Copper |
| 00:28 | Obsidian |
| 00:30.7 | Reset result, with the transition excluded |
| 00:32.5 | Go for a spin |

The edit skips stretches of autopilot between the three views, the return-to-autopilot countdown, and every reset transition. Each visible segment runs at normal simulation speed. Both players link to each other, the playable demo and the [published TIL](https://ciaranlyons.com/til/2026/09/13/teaching-a-printed-dragon-to-fly/).

## Recording method

The video runs the real Three.js renderer and Box3D simulation. [The recorder builder](../work/recording/build-short-recorder.mjs) creates an isolated preview from the current app and the included licensed model. [The short timeline](../work/recording/short-tour.js) calls the existing flight, steering, grab, material and reset controllers. It advances a fixed clock at 30 frames per second and uses Chrome’s WebCodecs H.264 encoder. Rendering can run faster or slower than real time without changing video timing.

A canvas combines the rendered scene with the title, captions, control status and model credits. The entire frame shares the rendered background. No browser chrome, desktop content or audio enters the export.

The throw moves the existing grab handle through a short wind-up and an upward/sideways stroke. The spring transfers momentum to the dragon. Releasing removes the spring without assigning a launch velocity or adding an impulse. The camera follows the toss and landing.

## Recreate the recordings

From the repository root, with Node 22 or newer:

```sh
npm ci
node work/recording/build-short-recorder.mjs
npx vite --config work/recording/short-vite.config.js
```

Open `http://127.0.0.1:4196/?format=portrait&both` in Chrome. It records portrait, saves it locally, then records widescreen. To export one format, use `?format=portrait` or `?format=widescreen`. Wait for “Saved widescreen demo” in the browser title. The local endpoint writes the H.264 streams and timing metadata to the ignored `recordings/` folder; `recording-preview/` is also ignored. No source files are overwritten.

Encode the raw streams into browser-ready MP4s with FFmpeg:

```sh
for format in portrait widescreen; do
  ffmpeg -framerate 30 -i "recordings/elder-$format.h264" \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
    -an -map_metadata -1 -movflags +faststart "recordings/elder-$format.mp4"
done
```

Copy the portrait MP4 to `outputs/dragon-feature-tour.mp4` and widescreen to `outputs/dragon-feature-tour-widescreen.mp4`. The current posters use the frame at 1.3 seconds:

```sh
ffmpeg -ss 1.3 -i outputs/dragon-feature-tour.mp4 -frames:v 1 -q:v 2 outputs/dragon-poster.jpg
ffmpeg -ss 1.3 -i outputs/dragon-feature-tour-widescreen.mp4 -frames:v 1 -q:v 2 outputs/dragon-poster-widescreen.jpg
exiftool -overwrite_original -all= outputs/dragon-feature-tour*.mp4 outputs/dragon-poster*.jpg
```

Probe the final files, decode them fully, and visually review the opening, every cut, the throw and landing, and the final frame. Both videos should contain 1,035 frames at 30 fps, lasting 34.5 seconds with no audio. Run [the combined site build](publishing.md) and verify both players and chapter buttons before publishing.

The older `work/recording/main.js`, `demo-grab.js`, `style.css`, `export.html` and `vite.config.js` preserve the original model’s recording setup. They are historical references; use the three `short-*`/`build-short-recorder` files above for the included Elder Fire model.

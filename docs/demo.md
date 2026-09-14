# Feature tour

[Watch portrait](https://clyons.github.io/dragon-flight-til/) · [Watch widescreen](https://clyons.github.io/dragon-flight-til/widescreen.html) · [Download MP4](../outputs/dragon-feature-tour.mp4)

72 seconds · 1080 × 1350 · portrait 4:5 · H.264 · 30 fps · no audio.

| Time | Feature |
| --- | --- |
| 00:03 | Head-led swoops and trailing tail |
| 00:17 | Left/right and upward head steering |
| 00:23 | Five-second handoff to autopilot |
| 00:33 | Drop and floor contact |
| 00:41 | Grab, lift, and shake a body section |
| 00:48 | Wind-up, upward throw, release at 00:50, and floor bump |
| 00:55 | Copper, Obsidian, and Jade |
| 01:06 | Reset dissolve |
| 01:09 | Closing attribution |

The original widescreen take is also included at 1920 × 906. The portrait edition adds the stronger wind-up and throw. Both players link to each other.

## Recording method

The video runs the real Three.js renderer and Box3D simulation. A recording-only timeline calls the same flight, steering, grab, material, and reset controllers. A 1080 × 1350 canvas combines the live scene with captions and controller status, and MediaRecorder captures that canvas. The entire frame shares one rendered background. An extended camera view preserves the dragon's framing without an inset colour seam. No browser chrome, desktop content, or audio enters this export.

The throw moves the existing grab handle through a short wind-up and a fast upward/sideways stroke. The spring transfers momentum to the dragon. Releasing removes the spring without assigning a launch velocity or adding an impulse. The camera follows the toss and landing.

## Recreate the recording

Use a separate local clone for the recording setup, and first follow [reproduction](reproduction.md) to install dependencies and prepare your own model assets. The recording sources are in [work/recording](../work/recording/).

From that clone's root:

```sh
cp work/recording/main.js src/main.js
cp work/recording/demo-grab.js src/demo-grab.js
cp work/recording/style.css src/style.css
cp work/recording/vite.config.js vite.config.js
cp work/recording/export.html export.html
npm run dev
```

Open http://127.0.0.1:4180/export.html in Chrome. This dedicated export entry starts the tour automatically after fonts load. Keep the tab visible for the full 72-second tour. The local endpoint writes `recordings/dragon-social-raw.webm`; the output folder is ignored by Git. Frame timing can differ slightly between runs.

Convert the output with FFmpeg and strip metadata from the exported copy with ExifTool:

```sh
ffmpeg -i recordings/dragon-social-raw.webm -vf fps=30 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -an -map_metadata -1 -movflags +faststart recordings/dragon-feature-tour.mp4
exiftool -overwrite_original -all= recordings/dragon-feature-tour.mp4
ffprobe -v error -show_format -show_streams recordings/dragon-feature-tour.mp4
```

Review the final frames before replacing `outputs/dragon-feature-tour.mp4` and its poster. Run [the video site build](publishing.md) and check playback again. The original model remains by [jars_2003 on MakerWorld](https://makerworld.com/en/models/2735519-articulated-dragon#profileId-3032774); see [asset attribution](attribution.md).

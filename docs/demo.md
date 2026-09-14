# Feature tour

[Watch portrait](https://clyons.github.io/dragon-flight-til/) · [Watch widescreen](https://clyons.github.io/dragon-flight-til/widescreen.html) · [Download MP4](../outputs/dragon-feature-tour.mp4)

Both editions: 31.4 seconds · H.264 · 30 fps · no audio. Portrait: 1080 × 1350 (4:5). Widescreen: 1920 × 906.

| Time | Feature |
| --- | --- |
| 00:00 | Head-led swoops and trailing tail; motion from the opening frames |
| 00:09 | Left/right and upward head steering |
| 00:14.8 | Pick up, shake, and wind up (2.5× playback) |
| 00:18 | Throw and landing at normal speed |
| 00:23 | Copper |
| 00:25.5 | Obsidian |
| 00:28 | Reset result, with the transition removed |
| 00:29.4 | Closing attribution |

The edit skips the initial stillness, the return-to-autopilot sequence, the separate drop demonstration, and the extra return-to-Jade material segment. All reset animation frames are excluded, including the final reset transition. The shake is compressed; the flight, steering, throw, landing, and material views remain at normal speed. Both players link to each other and to the [published TIL](https://ciaranlyons.com/til/2026/09/13/teaching-a-printed-dragon-to-fly/).

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
ffmpeg -i recordings/dragon-social-raw.webm -vf "fps=30,select='not(between(n,1170,1184)+between(n,1650,1664))',setpts=N/(30*TB)" -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -an -map_metadata -1 -movflags +faststart recordings/dragon-feature-tour.mp4
exiftool -overwrite_original -all= recordings/dragon-feature-tour.mp4
ffprobe -v error -show_format -show_streams recordings/dragon-feature-tour.mp4
```

The command above produces the earlier 71-second portrait edit, which is the input for the short portrait cut. The original widescreen input is the 72-second take. Build the final edits from these half-open frame ranges at 30 fps:

| Segment | Portrait input frames | Widescreen input frames | Playback speed |
| --- | --- | --- | --- |
| Flight | 93–363 | 93–363 | 1× |
| Steering | 513–687 | 513–687 | 1× |
| Grab and shake | 1218–1458 | 1233–1473 | 2.5× |
| Throw and landing | 1458–1608 | 1473–1623 | 1× |
| Copper | 1638–1713 | 1668–1743 | 1× |
| Obsidian | 1743–1818 | 1773–1848 | 1× |
| Reset result | 1968–2010 | 1998–2040 | 1× |
| Closing attribution | 2043–2103 | 2073–2133 | 1× |

For each range use FFmpeg `trim=start_frame=START:end_frame=END,setpts=(PTS-STARTPTS)/SPEED,fps=30`, then concatenate the segments. Encode H.264 with CRF 18, yuv420p, no audio, and faststart; strip metadata again. Each final video has 942 frames. These ranges match the reference takes; verify timing if recording again.

Review the opening, every cut boundary, and the full throw before replacing the videos in `outputs/`. Run [the video site build](publishing.md) and check playback again. The original model remains by [jars_2003 on MakerWorld](https://makerworld.com/en/models/2735519-articulated-dragon#profileId-3032774); see [asset attribution](attribution.md).

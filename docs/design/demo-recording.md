# Demo Recording

- **Status:** Planned — not yet recorded
- **Owner:** @Utaewook
- **Last updated:** 2026-10-17

The plan for the README demo GIF and the three screenshots marked `TODO(assets)` in
[`../../README.md`](../../README.md). Every choice below was settled before recording;
change one here first, not in the edit.

## Deliverables

| File | Shows | Replaces |
| --- | --- | --- |
| `assets/demo.gif` | Upload, node click, replay — one loop | `README.md` `TODO(assets)` under "Try it" |
| `assets/screenshot-upload-panel.png` | Upload panel | `README.md` `TODO(assets)` under "How it works" |
| `assets/screenshot-node-inspector.png` | Node inspector with statistics | same |
| `assets/screenshot-playback-bar.png` | Playback bar mid-replay | same |

All four come out of the same session, so the GIF and the stills show the same model and state.

## Decisions

| | Choice | Why |
| --- | --- | --- |
| Model | **SqueezeNet 1.1** (ONNX Model Zoo) | A real, recognisable model. Around 5 MB and roughly 65 nodes: Fire modules give the graph visible branching without shrinking it to noise. Far from the 50 MB upload cap |
| Environment | Production, `https://string-lights.dev/` | The GIF should match what the README's "Try it" link opens |
| Deploy state | Production must be on current `develop` first | Production lagged `develop` by 21 commits, including `bd5a3eb` (issue 002 — `std` reported as zero), which the inspector shot would show |
| Theme | Dark only | One take. Higher contrast on the canvas, fewer banding artefacts in a 256-colour GIF. Light-mode contrast is still unmeasured (`direction.md` → Open) |
| Scene order | Upload → node click → replay | Follows the README `TODO`. The surgery wait is cut in the edit, so upload does not eat the opening seconds |
| Size and storage | **≤ 5 MB**, committed at `assets/demo.gif` | Keeps the README path in the repository. 5 MB is the threshold [`assets/README.md`](./assets/README.md) uses for "large" |
| Tools | macOS screen recording (`Cmd+Shift+5`) + `ffmpeg` | Native capture shows the cursor; `ffmpeg` does trim, scale and palette in one reproducible command |

Note that [Constraints that still hold](./direction.md#constraints-that-still-hold) says
playback is what a demo shows first. This plan keeps the README order instead, so playback
gets the longest slot and the GIF ends on it rather than opening with it.

## Before recording

1. Confirm production serves the current `develop` (see Decisions → Deploy state).
2. Download `squeezenet1.1-7.onnx` (opset 7) to a directory **outside the repository**.
   Opset 7 is the floor the backend accepts
   ([issue 006](../issues/006-opset-ceiling-rejects-runnable-models.md)).
3. Check its input is a static float32 `[1,3,224,224]`. A static shape keeps
   [issue 017](../issues/017-non-batch-dynamic-axes-are-guessed.md) out of the shot, and float32
   avoids [issue 005](../issues/005-input-tensor-dtype-mismatch.md).
4. Rehearse once end to end and watch the tab's memory. All intermediate outputs are held in the
   browser and no ceiling has been measured
   ([issue 018](../issues/018-inference-memory-is-unbounded.md),
   [ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md) → Open questions).
   Record the peak here.
5. Rehearsal pass criteria: upload accepted, no WASM badge, inspector `std` non-zero on at least
   one node, playback walks the whole graph.

## Capture setup

- Chrome with WebGPU available, so the WASM fallback badge does not appear.
- Theme switched to dark in the app.
- Window around 1440×900, browser chrome hidden or cropped out; no bookmarks bar, no extensions.
- Record only the window (`Cmd+Shift+5` → *Record Selected Portion*). Cursor on.

## Shot list

| # | Scene | Target length |
| --- | --- | --- |
| 1 | Empty app → drop the model on the upload panel | 2–3 s |
| — | Surgery and session load — **cut in the edit** | 0 s |
| 2 | Graph appears → click one node → inspector shows dtype, shape, min / max / mean / std | 4–5 s |
| 3 | Start playback → let it walk several nodes → scrub backwards briefly | 6–8 s |
| 4 | Hold on the last frame so the loop restart is not abrupt | ~1 s |

Total about 15 s. Take the three screenshots from the same session after the GIF take.

## Converting to GIF

Cut the wait out with `select`, then build a palette from the clip itself:

```bash
ffmpeg -i capture.mov -vf "\
select='not(between(t,WAIT_START,WAIT_END))',setpts=N/FRAME_RATE/TB,\
fps=12,scale=960:-1:flags=lanczos,\
split[a][b];[a]palettegen=stats_mode=diff[p];\
[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
-loop 0 demo.gif
```

`WAIT_START` and `WAIT_END` are seconds in `capture.mov`. If the result is over 5 MB, lower
these in order: `fps` (12 → 10), then width (960 → 800), then shorten scene 3.

## Done when

- `assets/demo.gif` is ≤ 5 MB, loops, and shows all three scenes.
- The three screenshots are in `assets/`.
- Both `TODO(assets)` comments in `README.md` are replaced with the images.
- The rehearsal's memory peak is recorded under *Before recording*, step 4.
- This file's `Status` reads *Recorded*, with the date.

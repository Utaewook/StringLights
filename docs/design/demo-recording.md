# Demo Recording

- **Status:** Rehearsed 2026-10-17 — recording waits on
  [issue 020](../issues/020-replay-steps-one-node-at-a-time.md) (same-depth nodes highlight together)
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
| Model | **SqueezeNet 1.1** (ONNX Model Zoo, `squeezenet1.1-7.onnx`) | A real, recognisable model. 4.7 MB and 66 nodes: Fire modules give the graph visible branching. Far from the 50 MB upload cap |
| Environment | Production, `https://string-lights.dev/` | The GIF should match what the README's "Try it" link opens |
| Deploy state | Production on current `develop` — done 2026-10-17 (`2cd6ade`) | Production had lagged `develop` by 21 commits, including `bd5a3eb` (issue 002 — `std` reported as zero) |
| Theme | Dark only | One take. Higher contrast on the canvas, fewer banding artefacts in a 256-colour GIF. Light-mode contrast is still unmeasured (`direction.md` → Open) |
| Input | **Random tensors** | The default, zero tensors, makes `std` zero on every node by construction, which would look like the bug issue 002 fixed |
| Framing | **One Fire module, zoomed** — `conv1` through `concat0`, Explorer collapsed | Fit to screen, the 66 nodes sit in a single row at 0.07 zoom, 12×4 px each. Unreadable at 960 px. The camera does not follow playback, so the frame must be chosen in advance (see Rehearsal) |
| Playback speed | **1x** | 0.5 s per step. The framed module is steps 3–9, about 3.5 s of highlight travel. At 5x it would pass in under a second |
| Scene order | Upload → node click → replay | Follows the README `TODO`. Both waits are cut in the edit |
| Size and storage | **≤ 5 MB**, committed at `assets/demo.gif` | Keeps the README path in the repository. 5 MB is the threshold [`assets/README.md`](./assets/README.md) uses for "large" |
| Tools | macOS screen recording (`Cmd+Shift+5`) + `ffmpeg` | Native capture shows the cursor; `ffmpeg` cuts both waits, scales and builds the palette in one reproducible command |

Note that [Constraints that still hold](./direction.md#constraints-that-still-hold) says
playback is what a demo shows first. This plan keeps the README order instead, so playback
gets the longest slot and the GIF ends on it rather than opening with it.

## Rehearsal — 2026-10-17

Run on production at `2cd6ade`, Chrome 155, 1440×900 window, WebGPU available.

**Model check** (`onnx` 1.21.0 from the backend venv): opset 7, `checker.check_model` passes,
one input `data` float32 `[1,3,224,224]` with a static shape — so
[issue 017](../issues/017-non-batch-dynamic-axes-are-guessed.md) and
[issue 005](../issues/005-input-tensor-dtype-mismatch.md) stay out of the shot. 66 nodes:
26 Conv, 26 Relu, 8 Concat, 3 MaxPool, 1 each of Dropout, AveragePool, Reshape.

| Criterion | Result |
| --- | --- |
| Upload accepted | Pass — 66 nodes, 65 intermediate outputs |
| No WASM badge | Pass — header shows "WebGPU accelerated" |
| `std` non-zero on a node | Pass **with Random tensors** — `relu4`: input min −3.0758 → output min 0.0000, `std` 2.6898 |
| Playback walks the whole graph | Pass — step 0 to 65 |

| Measurement | Value |
| --- | --- |
| Graph surgery | ≤ 22.8 s (upper bound; includes tool latency) |
| Inference | ~17.0 s |
| Activations, as the app reports | 26.89 MB (27.46 MB in total) |
| JS memory after inference | 84 MB — worker 43 MB, window 38 MB (`measureUserAgentSpecificMemory`; excludes GPU memory; worker figure is post-run, not peak) |
| Playback | 0.5 s per step at 1x — 32.6 s for all 66 steps |

For [issue 018](../issues/018-inference-memory-is-unbounded.md): a model of this size is
nowhere near the tab's limit.

**Found during rehearsal**, none of which blocks recording:

- The canvas lays a chain out in a single row, so fit-to-screen makes nodes unreadable.
- Playback does not move the camera; the viewport transform is unchanged across a full run.
- The inspector does not follow playback; it keeps the node that was last clicked.
- The playback bar overlaps the bottom of the minimap.
- Upload takes two clicks after the drop: **Upload and analyze**, then **Run inference**.

## Before recording

1. Confirm production still serves the commit rehearsed above, or rehearse again.
2. Download `squeezenet1.1-7.onnx` to a directory **outside the repository**
   (SHA-256 `1eeff551a67ae8d565ca33b572fc4b66e3ef357b0eb2863bb9ff47a918cc4088`).

## Capture setup

- Chrome with WebGPU available, so the WASM fallback badge does not appear.
- Theme switched to dark in the app.
- Window 1440×900, browser chrome hidden or cropped out; no bookmarks bar, no extensions.
- Record only the window (`Cmd+Shift+5` → *Record Selected Portion*). Cursor on.

**Framing.** After clicking **Run inference**, and inside the wait that gets cut:

1. Collapse the Explorer (header, left button). The canvas widens from 864 to 1151 px.
2. Zoom with the scroll wheel over the first Fire module until `conv1_fwd` through `concat0`
   span about 85% of the canvas width — about 0.7 zoom. Nodes are then ~125×44 px.
3. Leave the Inspector open.

## Shot list

| # | Scene | Target length |
| --- | --- | --- |
| 1 | Empty app → drop the model on the upload panel → **Upload and analyze** | ~3 s |
| — | Graph surgery — **cut** | 0 s |
| 2 | Select **Random tensors** → **Run inference** | ~2 s |
| — | Inference, collapse Explorer, zoom to the Fire module — **cut** | 0 s |
| 3 | Click a Relu in frame (`relu2_fwd`) → inspector shows dtype, shape, min / max / mean / std; output min reads 0 | ~4 s |
| 4 | Play at **1x** from step 0. The highlight enters the frame at step 3 and reaches `concat0` at step 9, taking the upper branch before the lower one. Pause on `concat0` | ~5 s |
| 5 | Hold so the loop restart is not abrupt | ~1 s |

Total about 15 s. Take the three screenshots from the same session after the GIF take.

## Converting to GIF

Cut both waits with `select`, then build a palette from the clip itself:

```bash
ffmpeg -i capture.mov -vf "\
select='not(between(t,SURGERY_START,SURGERY_END)+between(t,INFER_START,INFER_END))',\
setpts=N/FRAME_RATE/TB,\
fps=12,scale=960:-1:flags=lanczos,\
split[a][b];[a]palettegen=stats_mode=diff[p];\
[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
-loop 0 demo.gif
```

The four placeholders are seconds in `capture.mov`. If the result is over 5 MB, lower these
in order: `fps` (12 → 10), then width (960 → 800), then shorten scene 4.

Check node labels after scaling. Op types (`Conv`, `Relu`) should read; the long node names
under them may not. If op types do not read either, crop the frame to the canvas and inspector
before scaling, rather than scaling the whole window.

## Done when

- `assets/demo.gif` is ≤ 5 MB, loops, and shows all five scenes.
- The three screenshots are in `assets/`.
- Both `TODO(assets)` comments in `README.md` are replaced with the images.
- This file's `Status` reads *Recorded*, with the date.

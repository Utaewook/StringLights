# Demo Recording

- **Status:** Rehearsed on 2026-10-17. The recording waits for
  [issue 020](../issues/020-replay-steps-one-node-at-a-time.md) (nodes at the same depth highlight together).
- **Owner:** @Utaewook
- **Last updated:** 2026-10-26

This document is the plan for the demo GIF and the three screenshots of the README.
The README marks their locations with `TODO(assets)` comments. See [`../../README.md`](../../README.md).
The project made each decision below before the recording.
If you change a decision, change it here first. Do not change it only in the edit.

## Deliverables

| File | Contents | Replaces |
| --- | --- | --- |
| `assets/demo.gif` | The upload, a node click, and the playback, in one loop | The `TODO(assets)` comment under "Try it" in `README.md` |
| `assets/screenshot-upload-panel.png` | The upload panel | The `TODO(assets)` comment under "How it works" in `README.md` |
| `assets/screenshot-node-inspector.png` | The inspector, with the tensor statistics | The same comment |
| `assets/screenshot-playback-bar.png` | The playback bar, in the middle of a playback | The same comment |

Make all four files in the same session. Then the GIF and the screenshots show the same model and the same state.

## Decisions

| Item | Choice | Reason |
| --- | --- | --- |
| Model | **SqueezeNet 1.1** (ONNX Model Zoo, `squeezenet1.1-7.onnx`) | It is a real model that people know. It is 4.7 MB and has 66 nodes. Its Fire modules show branches in the graph. It is far below the upload limit of 50MB. |
| Environment | Production, `https://string-lights.dev/` | The GIF must show the same site that the "Try it" link of the README opens. |
| Deploy state | Production runs the current `develop`. The deploy was on 2026-10-17 (`2cd6ade`). | Before that deploy, production was 21 commits behind `develop`. The missing commits included `bd5a3eb` (issue 002: `std` was always zero). |
| Theme | Dark only | One take is sufficient. The canvas has more contrast, and a GIF with 256 colors shows fewer color bands. Nobody measured the contrast of the light mode yet (see "Open questions" in `direction.md`). |
| Input | **Random tensors** | The default input is zero tensors. With zeros, `std` is zero on each node. That result looks like the bug that issue 002 fixed. |
| Framing | **One Fire module, with zoom**: `conv1` to `concat0`, with the Explorer collapsed | If the graph fits the screen, the 66 nodes show in one row at a zoom of 0.07. Each node is then 12×4 px, and you cannot read it at 960 px. The camera does not follow the playback. Thus, select the frame before the recording (see "Rehearsal"). |
| Playback speed | **1x** | Each step takes 0.5 s. The module in the frame is steps 3 to 9, so the highlight moves for approximately 3.5 s. At 5x, it would move for less than one second. |
| Scene order | Upload, then node click, then playback | This order follows the `TODO` comments of the README. The edit removes both waits. |
| Size and storage | **5 MB or less**, committed at `assets/demo.gif` | The README path then stays in the repository. [`assets/README.md`](./assets/README.md) uses 5 MB as the limit for a "large" file. |
| Tools | macOS screen recording (`Cmd+Shift+5`) and `ffmpeg` | The macOS recording shows the cursor. One `ffmpeg` command removes both waits, scales the video, and makes the palette. You can run the command again with the same result. |

[Constraints that still apply](./direction.md#constraints-that-still-apply) says that a demo shows the playback first.
This plan keeps the order of the README. Instead, the playback gets the longest part, and the GIF ends with it.

## Rehearsal (2026-10-17)

The rehearsal ran on production at `2cd6ade`, in Chrome 155, in a window of 1440×900, with WebGPU available.

**Model check** (with `onnx` 1.21.0 from the backend venv at that time):

- The model uses opset 7, and `checker.check_model` passed.
- The model has one input, `data`, float32 `[1,3,224,224]`, with a static shape. Thus, [issue 017](../issues/017-non-batch-dynamic-axes-are-guessed.md) and [issue 005](../issues/005-input-tensor-dtype-mismatch.md) do not affect the recording.
- The model has 66 nodes: 26 Conv, 26 Relu, 8 Concat, 3 MaxPool, 1 Dropout, 1 AveragePool, and 1 Reshape.

| Criterion | Result |
| --- | --- |
| The backend accepts the upload | Pass: 66 nodes, 65 intermediate tensors |
| No WASM Mode badge | Pass: the header showed "WebGPU accelerated" |
| `std` is not zero on a node | Pass **with Random tensors**: on `relu4`, the input minimum was −3.0758, the output minimum was 0.0000, and `std` was 2.6898 |
| The playback goes through the full graph | Pass: steps 0 to 65 |

| Measurement | Value |
| --- | --- |
| Graph Surgery | 22.8 s or less (an upper limit; it includes the latency of the tool) |
| Inference | Approximately 17.0 s |
| Intermediate tensors, as the app reports them ("activations" in the UI) | 26.89 MB (27.46 MB in total) |
| JS memory after inference | 84 MB: worker 43 MB, window 38 MB (`measureUserAgentSpecificMemory`). This value does not include GPU memory. The worker value is after the run, not the peak. |
| Playback | 0.5 s for each step at 1x: 32.6 s for all 66 steps |

For [issue 018](../issues/018-inference-memory-is-unbounded.md): a model of this size is far below the memory limit of the tab.

**Found during the rehearsal.** None of these items blocks the recording:

- The canvas puts a chain of nodes in one row. Thus, a fit to the screen makes the nodes too small to read.
- The playback does not move the camera. The viewport transform did not change during a full run.
- The inspector does not follow the playback. It keeps the node that you clicked last.
- The playback bar covers the bottom of the minimap.
- After the drop, the upload needs two clicks: **Upload and analyze**, then **Run inference**.

## Before the recording

1. Make sure that production still serves the commit of the rehearsal. If it does not, do the rehearsal again.
2. Download `squeezenet1.1-7.onnx` to a directory **outside the repository**.
   Its SHA-256 is `1eeff551a67ae8d565ca33b572fc4b66e3ef357b0eb2863bb9ff47a918cc4088`.

## Capture setup

- Use Chrome with WebGPU available. Then the WASM Mode badge does not show.
- Set the theme of the app to dark.
- Use a window of 1440×900. Hide the browser frame, or cut it from the video. Do not show the bookmarks bar or extensions.
- Record only the window (`Cmd+Shift+5`, then *Record Selected Portion*). Show the cursor.

**Framing.** Do these steps after you click **Run inference**, during the wait that the edit removes:

1. Collapse the Explorer (the left button in the header). The canvas becomes wider, from 864 px to 1151 px.
2. Use the scroll wheel to zoom on the first Fire module. Stop when `conv1_fwd` to `concat0` fill approximately 85% of the canvas width.
   The zoom is then approximately 0.7, and each node is approximately 125×44 px.
3. Keep the inspector open.

## Shot list

| # | Scene | Length |
| --- | --- | --- |
| 1 | The empty app. Drop the model on the upload panel. Click **Upload and analyze**. | Approximately 3 s |
| — | Graph Surgery: **remove** in the edit | 0 s |
| 2 | Select **Random tensors**. Click **Run inference**. | Approximately 2 s |
| — | Inference, the Explorer collapse, and the zoom to the Fire module: **remove** in the edit | 0 s |
| 3 | Click a Relu node in the frame (`relu2_fwd`). The inspector shows the dtype, the shape, and the minimum, maximum, mean, and `std`. The output minimum is 0. | Approximately 4 s |
| 4 | Start the playback at **1x** from step 0. The highlight comes into the frame at step 3 and gets to `concat0` at step 9. It goes through the upper branch before the lower branch. Pause on `concat0`. | Approximately 5 s |
| 5 | Wait a short time, so that the start of the next loop is not sudden. | Approximately 1 s |

The total is approximately 15 s. After the GIF take, take the three screenshots in the same session.

## Conversion to GIF

Remove both waits with `select`. Then make a palette from the clip:

```bash
ffmpeg -i capture.mov -vf "\
select='not(between(t,SURGERY_START,SURGERY_END)+between(t,INFER_START,INFER_END))',\
setpts=N/FRAME_RATE/TB,\
fps=12,scale=960:-1:flags=lanczos,\
split[a][b];[a]palettegen=stats_mode=diff[p];\
[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
-loop 0 demo.gif
```

The four placeholders are times in seconds in `capture.mov`.
If the result is more than 5 MB, decrease these values in this sequence:

1. `fps` (from 12 to 10).
2. The width (from 960 to 800).
3. The length of scene 4.

After the scaling, examine the node labels. You must be able to read the operator types (`Conv`, `Relu`).
You may not be able to read the long node names under them.
If you cannot read the operator types, cut the frame to the canvas and the inspector before the scaling. Do not scale the full window.

## Completion criteria

- `assets/demo.gif` is 5 MB or less, it loops, and it shows all five scenes.
- The three screenshots are in `assets/`.
- The images replace the two `TODO(assets)` comments in `README.md`.
- The `Status` of this file is *Recorded*, with the date.

# UI/UX Direction

- **Status:** Chosen. See [ADR 0003](../decisions/0003-adopt-shadcn-design-system.md).
- **Owner:** @Utaewook
- **Last updated:** 2026-10-26

## The direction

The web app uses the **Shadcn** design system for all of its UI.
The style is shadcn/ui `radix-nova`, with the neutral base color and lucide icons.
This file is the style guide of the project. It gives the rules and the status of the migration.
ADR 0003 records the trade-off that the project accepted.

### Location of the design system

| Item | Value |
| --- | --- |
| Project | `Shadcn` on claude.ai/design |
| Project id | `3e9943b6-fb13-4931-bb8e-09f11a035088` |
| How to read it | The `DesignSync` tool: `list_files`, then `get_file`. The design system is **not** in this repository, and it is not an Artifact. |
| Where to start | `readme.md` (the foundations, in prose). Then read the `*.prompt.md` file of each component. |
| Vendored copy | `apps/web-app/src/styles/ds/` (tokens and CSS only) |

## Rules

These rules let you examine a component without the design system.
The `readme.md` file of the design system project gives the full text.

**Color.** All colors use `oklch()`. The base is neutral.
In the source, the only token with a hue is `--destructive`.
The accent is **`theme-indigo`**. The app applies it as a class on `<html>`, together with `.dark`.
A theme changes only the accent channel. The neutral colors do not change.

**Type.** Use Geist for all text. Use Geist Mono for tensor names, shapes, dtypes, and all numbers.
**The product default is 14px.** Use 16px for text to read, and 12px muted text for captions.
Headings use a letter spacing of `-0.025em`. Card titles are 16px medium, not bold.

**Space and size.** The unit is 4px.
The default height of a control is **32px**. The alternatives are 24px, 28px, and 36px.
Buttons have an inline padding of `0.625rem`. Cards have `1rem`, and small cards have `0.75rem`.
Do not use the larger 40px sizes of standard shadcn.

**Radius.** One variable controls the radius: `--radius: 0.625rem`.
The sizes are sm 6, md 8, lg 10 (buttons, inputs, menus), xl 14 (cards, dialogs), and pill (badges).
Checkboxes always use 4px.

**Elevation.** A surface in the page gets a thin ring, `0 0 0 1px var(--foreground)/10%`, and **no drop shadow**.
Only floating surfaces add a shadow on top of the ring: `shadow-md` for menus and popovers, and `shadow-lg` for dialogs and toasts.

**Backgrounds.** Use flat colors. Do not use gradients, glows, radial washes, or textures.
One transparency effect is permitted: the sticky header uses `background/80` and `backdrop-blur(8px)`.

**States.**

- Hover on a solid control decreases the opacity to 80%. It does not make the control darker.
- Press moves the control 1px down. It does not change the scale.
- Focus shows a 3px `--ring/50` halo and a `--ring` border. Do not remove the focus style.
- Disabled is `opacity: 0.5`.
- Destructive uses a tint. Do not use a solid red block.

**Motion.** Fades and menus take 100ms. Hover and color changes take 150ms. Sheets and accordions take 200ms.
The easing is `cubic-bezier(0, 0, 0.2, 1)`. Nothing bounces. Only the skeleton pulse loops.

**Icons.** Use only lucide icons, with `currentColor`.
Size each icon to its control: 16px by default, 14px for `sm`, and 12px for `xs` and in badges.
**Do not use emoji**, in labels or in empty states.

**Copy.** These rules apply to the text in the UI:

- Use sentence case.
- Use the second person and the present tense.
- Use nouns for labels and verbs for buttons.
- Keep descriptions under ten words.
- Format numbers, for example `182 ms` and `12,480`. Do not show raw numbers.
- Do not use exclamation marks or "Oops". A failure state is neutral and tells the user what to do.

## What we add on top

The design system does not include three items. The project maintains them.
Each item follows the existing patterns of the system.

1. **`--ds-success` and `--ds-warning`.** The WASM Mode badge and the warnings for `NaN` and `Inf` values need these tokens.
   They use the same pattern as `--destructive`: a 10% tint background with full-strength text, never a solid block.
   Color is never the only signal. Use a lucide icon and a label with it.
2. **Graph node style.** The node style comes from the `Card` tokens (radius, border, surface).
   The canvas is the product, so the other parts of the UI stay less prominent.
   But the canvas uses the same system. It is not an exception.
3. **Links as buttons.** `Button` accepts `asChild`, so a link can use the button style.
   `extensions.css` removes the underline that `base.css` puts on each `a`.
   The system does the same for some components (`.ds-breadcrumb a`). Our rule applies it to `a.ds-btn`.
   The Ko-fi link needs this rule. The Ko-fi script widget and the CDN badge are cross-origin subresources, and COEP `require-corp` blocks them.
   See [ADR 0002](../decisions/0002-coep-require-corp.md). The icon is a lucide icon, not a brand asset.

## The brand mark

The mark shows three bulbs on a wire. The last bulb is dead.
The pack arrived on 2026-08-29. The SVG files are the originals. All other files come from them.

| Item | Value |
| --- | --- |
| Sources | `apps/web-app/src/assets/icon/`: ten SVG files on one 64x64 grid |
| Served | `apps/web-app/public/`: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` |

**Two densities, one family.** The full mark has three elements. Below 48px, these elements are not clear.
Thus, a `-mini` variant with one bulb exists for small sizes. Obey this rule:

- **48px or smaller**, or cut to a circle (avatars): use `-mini`.
- **64px or larger**: use the full mark.

**Two tones.** `amber-night` has a dark navy plate. `amber-light` has a pale grey plate (`#EEF0F4`).
Each tone has its own background. Thus, select the tone that **contrasts with the surface behind it**. Do not select the tone that matches the theme.
The names suggest the opposite.
On a pure white background, the pale plate has no visible edge. In these locations, use the `-bordered` variant.

The project uses the tones as follows:

| Place | File | Reason |
| --- | --- | --- |
| App header, dark | `amber-night-mini.svg` | 18px, thus mini |
| App header, light | `amber-light-mini-bordered.svg` | 18px on an almost white header, thus mini and bordered |
| README, GitHub light theme | `amber-night.svg` | Navy plate on a white page |
| README, GitHub dark theme | `amber-light.svg` | Pale plate on a dark page |

The `-square` variants exist because iOS and Android apply their own corner mask.
If a mark already has round corners, the mask cuts the corners two times.
The project made `apple-touch-icon.png` and the PWA icons from the `-square` variants.

`site.webmanifest` sets `theme_color` to `#0A0F1C`. This is the navy color of the mark, so the PWA splash screen continues the icon.
This color is intentionally not the `--background` of the app.
Also, the app has no `<meta name="theme-color">`. A navy browser frame would not match the neutral palette in either mode.

## Surface map

| Surface | File | Design system component | Status |
| --- | --- | --- | --- |
| Header, WASM Mode badge, and Ko-fi link | `components/layout/Header.tsx` | `Button` (with `asChild`), `Badge` | Done |
| Upload and run controls, run budget | `features/inference/InferencePanel.tsx` | `Button`, `Input`, `Label`, `Alert` | Done |
| Switch for the data mode | `features/inference/InferencePanel.tsx` | `Tabs` | Done |
| File chips | `features/inference/InferencePanel.tsx` | Card style, Badge tint | Done |
| Sidebar (explorer) | `components/layout/Sidebar.tsx` | Sidebar tokens | Done |
| Graph canvas | `components/common/GraphCanvas.tsx` | Derived from `Card` | Done |
| Sections of the inspector | `features/inspector/NodeInspector.tsx` | `Accordion` | Done |
| Tensor statistics | `features/inspector/NodeInspector.tsx` | `Table` | Done |
| Playback controls | `components/layout/PlaybackBar.tsx` | `Button`, `ToggleGroup` | Done |
| Toasts | `components/common/ToastContainer.tsx` | `Toast` surface | Done |

Two items changed when the project wrote the code. Keep the reasons:

- **File chips do not use `Badge`.** A chip has an icon, a file name, a size, and a remove control.
  Thus, it is a list row, not a label. It uses the Card style. Only the role tint uses the Badge pattern.
- **The playback scrubber does not use `Slider`.** The slider of the system is three `div` elements with a drag handler.
  A native `range` input already supports the keyboard, drag, and touch. Thus, only its appearance uses the slider tokens.

The project ports each component from `.jsx` to `.tsx` in `components/ui/` **when the app first uses it**.
See [the README of that directory](../../apps/web-app/src/components/ui/README.md) for the reason.

## How to verify

Six surfaces show only after a model loads. Until 2026-08-29, this blocked their verification.
You do not need a new dependency to verify them, because `onnx` is already in the `requirements.txt` of the backend.
Make a test model (a fixture) with `onnx`. Write the fixture **outside the repository**, because a session must not leave temporary files.

A chain of nine nodes is sufficient for all surfaces: `Conv -> Relu -> MaxPool -> Conv -> Relu -> MaxPool -> Flatten -> Gemm -> Softmax`, with a float32 `[1,1,8,8]` input.
The file is approximately 3.4 KB.
The canvas shows a real graph, the playback has nine steps, and the inspector gets tensors with shapes and statistics.

Stay inside the limits of the app:

- Use an opset from 7 up to the highest opset that the pinned `onnx` supports. See
  [issue 006](../issues/006-opset-ceiling-rejects-runnable-models.md).
- Use a **float32** input. The frontend refuses some input dtypes, for example `float16`. See
  [issue 005](../issues/005-input-tensor-dtype-mismatch.md).

The frontend puts the files in a ZIP archive before `POST /api/surgery`.
Thus, a direct `curl` request must send a ZIP file in the form field `file`, not the raw `.onnx` file.

One path is not verified yet. A run with zeros or random values cannot produce the `NaN` and `Inf` row of the inspector.
The project checked the style of this row with a direct render.

## Migration

The migration is incremental.
A bridge file maps the old variables (`--bg-primary`, `--accent-color`, and others) to the design system tokens.
Thus, `App.css` continues to work without changes, and the project moves one surface at a time.
**The migration is complete when the bridge is empty.**

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Decide the direction, record the ADR, and rewrite this file | Done |
| 1 | Copy the tokens to `src/styles/ds/`, add the bridge file, and connect the light/dark toggle | Done |
| 2 | Convert the surfaces of the map above. Port each component to `.tsx` when a surface uses it | Done |
| 3 | Delete the migrated rules from `App.css`. Move the remaining rules to the CSS file of each feature | In progress: 1033 to 311 lines |
| 4 | Visual QA in both modes, a contrast check, and a review of the failure states (WASM badge, `NaN`, a model that is too large) | Partly done: both modes are checked with a model loaded. The contrast check and the failure states are not done |

Phase 3 ran at the same time as phase 2, not after it.
When the project converted a surface, it also moved the rules of that surface to the CSS file of the feature.
Thus, each rule moved one time, with the component that owns it. The project did not edit the rules in place and move them again later.

`App.css` still contains these rules:

- the header,
- the empty workspace and its watermark,
- the upload zone,
- the model status panel,
- the list of input settings,
- the old `.btn` class and the spin animation,
- the shared token block.

The bridge has 138 lines. It cannot become empty until the project removes that token block.

Geist loads from Google Fonts with `@import`. It works with COEP `require-corp`.
The project verified this on 2026-08-22: both Google hosts send `cross-origin-resource-policy: cross-origin`.
You can host the `.woff2` files yourself, but this is optional.

`uiStore` keeps the theme state. The app saves it in `localStorage` with the key `stringlights-theme`.
The default comes from `prefers-color-scheme`.
An inline script in `index.html` applies the theme before the first paint. This script copies the logic of `utils/theme.ts`.
Thus, keep the storage key the same in the two locations.

The project examined each surface in both modes with a model loaded. It used the fixture of **How to verify**.
Phase 4 still needs two items: a measured contrast check, and a review of the failure states.
The failure states are the WASM fallback, a tensor with `NaN` values, and a model that is too large.

## Constraints that still apply

1. **The graph canvas is the product.** The other parts of the UI stay less prominent than the canvas.
2. **The playback is the main interaction.** A demo shows it first.
3. **The numbers are the main content.** The inspector displays data. It is not a form. Thus, it uses `Table` and Geist Mono.
4. **Failure states are normal here.** The WASM fallback, `NaN` detection, and models that are too large are normal results. They get a designed treatment.

## What `legacy-v1` is for

Section 5 of `CLAUDE.md` tells you to examine the `legacy-v1` branch before you make a UI component.
Since ADR 0003, use this branch **only for interaction and structure**. Do not use its palette or its type.

Its visual style copies VS Code: `#1e1e1e` and `#252526` surfaces, a `#007fd4` accent, and Inter.
Version 2 did not use this style even before the project adopted the design system. Do not use it again.

These files are useful:

| File | Contents |
| --- | --- |
| `frontend/src/index.css` | 879 lines. The styles were in this file. `App.css` is empty. |
| `frontend/src/store/uiStore.js` | It already had `theme`, `toggleTheme`, and a `.light-theme` palette. |
| `frontend/src/components/layout/` | The same layout components as v2, from one generation before. |

The theme toggle is an example of what not to do.
Phase 1 made the toggle again without a look at `legacy-v1`. But `legacy-v1` already had one, with the same store shape and the same location in the header.
The project lost nothing. But it also learned nothing from the old toggle.
Section 5 of `CLAUDE.md` exists to prevent this failure.

## Open questions

- Did anybody measure the contrast of the light mode? Nobody checked this UI with a contrast checker yet.

### Answered

- **Was the canvas readable in light mode? Answered on 2026-08-29: no. The project fixed it.**
  `GraphCanvas.tsx` had five fixed colors that CSS could not change. The minimap showed an almost black block on a white page.
  Now these colors come from the tokens, and they change when the theme changes.

## Assets

Put screenshots, references, and mockups in [`./assets/`](./assets/).
[`./demo-recording.md`](./demo-recording.md) gives the plan for the README demo GIF and the screenshots.

# UI/UX Direction

- **Status:** Chosen — see [ADR 0003](../decisions/0003-adopt-shadcn-design-system.md)
- **Owner:** @Utaewook
- **Last updated:** 2026-08-29

## The direction

The web app follows the **Shadcn** design system (shadcn/ui `radix-nova` style, neutral
base, lucide icons), adopted wholesale. This file is the living style guide: what the rules
are and how far the migration has got. The trade-off that was accepted is in the ADR.

### Where the design system lives

| | |
| --- | --- |
| Project | `Shadcn` on claude.ai/design |
| Project id | `3e9943b6-fb13-4931-bb8e-09f11a035088` |
| How to read it | The `DesignSync` tool — `list_files`, then `get_file`. It is **not** in this repository and not an Artifact |
| Where to start | `readme.md` (foundations in prose), then the per-component `*.prompt.md` |
| Vendored copy | `apps/web-app/src/styles/ds/` — tokens and CSS only |

## Rules

Enough to judge a component against without fetching the design system. `readme.md` in the
project is the full text.

**Color.** All `oklch()`. Neutral base; the only chromatic token upstream is
`--destructive`. Accent is **`theme-indigo`**, applied as a class on `<html>` alongside
`.dark`. Themes re-point the accent channel only — neutrals never move.

**Type.** Geist for everything, Geist Mono for tensor names, shapes, dtypes and every
number. **14px is the product default.** 16px for reading text, 12px muted for captions.
Headings tighten to `-0.025em`. Card titles are 16px medium, not bold.

**Space and size.** 4px unit. Default control height **32px** (24/28/36 alternates).
Buttons pad `0.625rem` inline, cards `1rem`, small cards `0.75rem`. Do not scale up to the
40px "comfortable" sizing of stock shadcn.

**Radius.** One knob: `--radius: 0.625rem`. sm 6 / md 8 / lg 10 (buttons, inputs, menus) /
xl 14 (cards, dialogs) / pill (badges). Checkboxes are a hard 4px.

**Elevation.** In-page surfaces get a hairline ring — `0 0 0 1px var(--foreground)/10%` —
and **no drop shadow**. Only floating surfaces add one: `shadow-md` for menus and popovers,
`shadow-lg` for dialogs and toasts, on top of the ring.

**Backgrounds.** Flat color. No gradients, no glows, no radial washes, no texture. The one
transparency effect permitted is the sticky header: `background/80` + `backdrop-blur(8px)`.

**States.** Hover on solid controls reduces opacity to 80% — it does not darken. Press
nudges 1px down, no scale. Focus is a 3px `--ring/50` halo plus a `--ring` border and is
never removed. Disabled is `opacity: 0.5`. Destructive is tinted, never a solid red slab.

**Motion.** 100ms fades and menus, 150ms hover and color, 200ms sheets and accordions.
Easing `cubic-bezier(0, 0, 0.2, 1)`. Nothing bounces, nothing loops except the skeleton
pulse.

**Icons.** lucide only, `currentColor`, sized to the control: 16px default, 14px `sm`,
12px `xs` and in badges. **No emoji anywhere** — not in labels, not in empty states.

**Copy.** Sentence case. Second person, present tense. Labels are nouns, buttons are verbs.
Descriptions under ten words. Numbers formatted, never raw (`182 ms`, `12,480`). No
exclamation marks, no "Oops" — failure states are neutral and say what to do.

## What we add on top

Two things the design system does not cover. Both are ours to maintain, and both follow its
existing patterns rather than inventing new ones.

1. **`--success` / `--warning`.** Needed for the engine badge and tensor integrity warnings.
   Built like `--destructive`: a 10% tint background with full-strength text, never a solid
   slab. Colour is never the only signal — pair with a lucide icon and a label.
2. **Graph node style.** Derived from the `Card` tokens (radius, border, surface). The
   canvas is the product, so chrome stays subordinate to it — but it is the same system,
   not an exception to it.

## Surface map

| Surface | File | Design system component | Status |
| --- | --- | --- | --- |
| Header + engine badge | `components/layout/Header.tsx` | `Button`, `Badge` | Done |
| Upload + run controls | `features/inference/InferencePanel.tsx` | `Button`, `Input`, `Label`, `Alert` | Done |
| Data mode switch | `features/inference/InferencePanel.tsx` | `Tabs` | Done |
| File chips | `features/inference/InferencePanel.tsx` | Card treatment, Badge tint | Done |
| Sidebar (explorer) | `components/layout/Sidebar.tsx` | sidebar tokens | Done |
| Graph canvas | `components/common/GraphCanvas.tsx` | derived from `Card` | Done |
| Node inspector sections | `features/inspector/NodeInspector.tsx` | `Accordion` | Done |
| Tensor statistics | `features/inspector/NodeInspector.tsx` | `Table` | Done |
| Playback transport | `components/layout/PlaybackBar.tsx` | `Button`, `ToggleGroup` | Done |
| Toasts | `components/common/ToastContainer.tsx` | `Toast` surface | Done |

Two entries did not survive contact with the code, and the reasons are worth keeping:

- **File chips are not `Badge`.** A chip carries an icon, a filename, a size and a remove
  control. That is a list row, not a label. It takes the Card treatment; only the role tint
  follows the Badge pattern.
- **The transport scrubber is not `Slider`.** The system's slider is three divs driven by a
  drag handler. A native `range` input already handles keyboard, drag and touch, so only
  its skin moved onto the slider tokens.

Components are ported from `.jsx` to `.tsx` into `components/ui/` **as each is first
used** — see its README for why bulk-copying does not work here.

## How to verify

Six of these surfaces only render once a model is loaded, which blocked them until
2026-08-29. Clearing it needs no new dependency: `onnx` is already in the backend's
`requirements.txt` and installed in `apps/backend/venv`. Build a fixture with it, writing
it **outside the repository** — a session must leave no temp files behind.

A nine-node chain is enough to exercise every surface: `Conv -> Relu -> MaxPool -> Conv ->
Relu -> MaxPool -> Flatten -> Gemm -> Softmax`, float32 `[1,1,8,8]` input, about 3.4 KB.
The canvas lays out a real graph, playback has nine steps to walk, and the inspector gets
tensors with shapes and statistics.

Stay inside the constraints the backend enforces: **opset 7-21** (see
[issue 006](../issues/006-opset-ceiling-rejects-runnable-models.md)) and a **float32** input, which
sidesteps [issue 005](../issues/005-input-tensor-dtype-mismatch.md)'s dtype bug. The frontend zips
files client-side before `POST /api/surgery`, so a direct `curl` needs a zip under the form
field `file` — not the raw `.onnx`.

One path stays unverified: the inspector's NaN/Inf integrity row cannot be produced by a
zero-tensor or random-tensor run. Its styling was checked by rendering the row directly.

## Migration

Incremental. A bridge file re-points the legacy variables (`--bg-primary`,
`--accent-color`, …) at design-system tokens, so `App.css` keeps working untouched while
surfaces move one at a time. **The bridge shrinking to nothing is the definition of done.**

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Decide direction, record ADR, rewrite this file | Done |
| 1 | Vendor tokens into `src/styles/ds/`, add bridge file, wire the light/dark toggle | Done |
| 2 | Convert surfaces per the map above, porting each component to `.tsx` as it is used | Done |
| 3 | Delete migrated rules from `App.css`, split the remainder into feature-local CSS | In progress — 1033 -> 462 lines |
| 4 | Visual QA in both modes, contrast check, failure-state review (WASM badge, NaN, oversized model) | Partly — both modes checked with a model loaded; contrast and failure states outstanding |

Phase 3 ran alongside Phase 2 rather than after it. Splitting each surface's rules into a
feature-local stylesheet as that surface was converted meant the rules moved once, with the
component that owns them, instead of being edited in place and moved again later.

What is left in `App.css` is the header, the workspace watermark, the upload zone, the
model-info and model-input panels, and the shared token block. The bridge is down to 142
lines and cannot empty until that token block goes.

Geist loads from Google Fonts by `@import` and works under COEP `require-corp` — verified
2026-08-22, both Google hosts send `cross-origin-resource-policy: cross-origin`. Self-hosting
the `.woff2` files is optional, not a prerequisite.

Theme state lives in `uiStore` and persists to `localStorage` under `stringlights-theme`,
defaulting to `prefers-color-scheme`. An inline script in `index.html` applies it before
first paint; it duplicates the logic in `utils/theme.ts`, so the storage key must stay in
step across the two.

Every surface has now been seen in both modes with a model loaded, using the fixture recipe
under **How to verify**. What Phase 4 still owes: a measured contrast pass, and the failure
states — WASM fallback, a NaN-bearing tensor, an oversized model.

## Constraints that still hold

1. **The graph canvas is the product.** Chrome stays subordinate to it.
2. **Playback is the signature interaction.** It is what a demo shows first.
3. **Numbers are the payload.** The inspector is data display, not a form — hence `Table`
   and Geist Mono.
4. **Failure states are normal here.** WASM fallback, NaN detection and oversized models are
   routine outcomes and get designed treatment, not an afterthought.

## What `legacy-v1` is for

`CLAUDE.md` §5 points at the `legacy-v1` branch before any UI component is generated. Since
ADR 0003, that reference is about **interaction and structure only** — never palette or type.

Its visual language is a VSCode pastiche (`#1e1e1e` / `#252526` surfaces, `#007fd4` accent,
Inter) that v2 had already left behind before the design system was adopted. Do not bring it
back.

What is worth reading there:

| | |
| --- | --- |
| `frontend/src/index.css` | 879 lines — where the styling actually lived. `App.css` is empty |
| `frontend/src/store/uiStore.js` | Already had `theme` + `toggleTheme`, and a `.light-theme` palette |
| `frontend/src/components/layout/` | Same four surfaces as v2, one generation earlier |

The theme toggle is the cautionary example: Phase 1 rebuilt it here without checking
`legacy-v1`, which already had one — same store shape, same position in the header. Nothing
was lost, but nothing was learned from it either. That is the failure §5 exists to prevent.

## Open

- **Answered 2026-08-29: it was not, and it is fixed.** The canvas was illegible in light
  mode because five colours were hardcoded in `GraphCanvas.tsx` where CSS could not reach
  them — the minimap drew a near-black slab over a white page. They resolve from tokens now
  and re-resolve when the theme changes.
- Is the light-mode contrast measured rather than eyeballed? Nothing here has been through
  a contrast checker.

## Assets

Screenshots, references, and mockups belong in [`./assets/`](./assets/).

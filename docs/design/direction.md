# UI/UX Direction

- **Status:** Chosen — see [ADR 0003](../decisions/0003-adopt-shadcn-design-system.md)
- **Owner:** @Utaewook
- **Last updated:** 2026-08-22

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

| Surface | File | Design system component |
| --- | --- | --- |
| Header + engine badge | `components/layout/Header.tsx` | `Badge` / `Alert` |
| Sidebar (explorer) | `components/layout/Sidebar.tsx` | sidebar tokens |
| Upload + run controls | `features/inference/InferencePanel.tsx` | `Button`, `Input`, `Label`, `Badge` |
| Data mode switch | `features/inference/InferencePanel.tsx` | `Tabs` |
| Graph canvas | `components/common/GraphCanvas.tsx` | derived from `Card` |
| Node inspector sections | `features/inspector/NodeInspector.tsx` | `Accordion` |
| Tensor statistics | `features/inspector/NodeInspector.tsx` | `Table` |
| Playback transport | `components/layout/PlaybackBar.tsx` | `Button`, `ToggleGroup`, `Slider` |
| Toasts | `components/common/ToastContainer.tsx` | `Toast` + `Toaster` |

## Migration

Incremental. A bridge file re-points the legacy variables (`--bg-primary`,
`--accent-color`, …) at design-system tokens, so `App.css` keeps working untouched while
surfaces move one at a time. **The bridge shrinking to nothing is the definition of done.**

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Decide direction, record ADR, rewrite this file | Done |
| 1 | Vendor tokens into `src/styles/ds/`, add bridge file, wire the light/dark toggle | Done |
| 2 | Convert surfaces per the map above, porting each component to `.tsx` as it is used | Not started |
| 3 | Delete migrated rules from `App.css`, split the remainder into feature-local CSS | Not started |
| 4 | Visual QA in both modes, contrast check, failure-state review (WASM badge, NaN, oversized model) | Not started |

Geist loads from Google Fonts by `@import` and works under COEP `require-corp` — verified
2026-08-22, both Google hosts send `cross-origin-resource-policy: cross-origin`. Self-hosting
the `.woff2` files is optional, not a prerequisite.

Theme state lives in `uiStore` and persists to `localStorage` under `stringlights-theme`,
defaulting to `prefers-color-scheme`. An inline script in `index.html` applies it before
first paint; it duplicates the logic in `utils/theme.ts`, so the storage key must stay in
step across the two.

**Phase 1 was verified with an empty workspace only.** Header, sidebar, upload zone and the
empty states were checked in both modes. The graph canvas, node inspector, playback bar and
toasts have not been seen with a model loaded — that is Phase 4's job, and it needs a test
model the project does not have yet (see [ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md)'s
open question about demo models).

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

- Is the canvas legible in light mode? Edges, minimap and selection highlight were tuned
  against a near-black background.

## Assets

Screenshots, references, and mockups belong in [`./assets/`](./assets/).

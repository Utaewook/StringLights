# UI/UX Direction

- **Status:** Draft — direction not yet chosen
- **Owner:** @Utaewook
- **Last updated:** 2026-08-22

## Why this document exists

The current interface works but reads as generic — the default shape a tool takes when
no one has chosen a point of view for it. That is a positioning problem, not a defect,
so it is tracked here rather than in [`../issues/`](../issues/).

This document is the trigger target for `apps/web-app/src/**` in `CLAUDE.md` §2. It
should say what the interface is trying to feel like, precisely enough that a component
can be judged against it.

## Where things stand

The application shell is already in place:

| Surface | File | Current state |
| --- | --- | --- |
| Header + engine badge | `components/layout/Header.tsx` | WebGPU / WASM status pill |
| Sidebar (explorer) | `components/layout/Sidebar.tsx` | Model upload entry point |
| Graph canvas | `components/common/GraphCanvas.tsx` | ReactFlow + dagre layout |
| Node inspector | `features/inspector/NodeInspector.tsx` | Accordion, tensor stats table |
| Playback bar | `components/layout/PlaybackBar.tsx` | 0.5× / 1× / 2× / 5× scrubbing |
| Toasts | `components/common/ToastContainer.tsx` | Transient feedback |

Styling is vanilla CSS in `App.css` / `index.css`. There is no token layer, so spacing,
colour, and type decisions are made per component.

## Constraints

1. **Reference `legacy-v1`.** `CLAUDE.md` §5 requires checking the previous version's
   visual language before generating components. That comparison has never been written
   down; doing so is the first task below.
2. **The graph canvas is the product.** Chrome must stay subordinate to it.
3. **Playback is the signature interaction.** It is the one thing competing tools do not
   have, and it is what a demo will show first.
4. **Numbers are the payload.** Tensor statistics are dense, frequently scanned, and
   compared against each other — treat the inspector as data display, not as a form.
5. **Failure states are normal here.** WASM fallback, NaN detection, and oversized models
   are routine outcomes, not edge cases. They deserve designed treatment.

## Open questions

- What visual direction? Not "clean and minimal" — that is the current default and the
  reason for this document.
- Light, dark, or both? Debugging tools are commonly used in dark environments, but this
  should be a decision, not an inheritance.
- Typography: what carries the numeric tables?
- How is "this node has NaN" expressed without relying on colour alone?
- Does the empty state teach the product, or just wait for an upload?

## Next steps

1. Capture what `legacy-v1` looked like and what was worth keeping.
2. Gather references and commit to one direction.
3. Extract a token layer (colour, spacing, type scale) before touching components.
4. Record the chosen direction as an ADR in [`../decisions/`](../decisions/), then reduce
   this file to the living style guide.

## Assets

Screenshots, references, and mockups belong in [`./assets/`](./assets/).

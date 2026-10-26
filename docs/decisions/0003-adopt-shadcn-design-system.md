# 0003. Adopt the complete Shadcn design system for the web app

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

[`../design/direction.md`](../design/direction.md) recorded a complaint about the interface.
The interface "reads as generic — the default shape a tool takes when no one has chosen a point of view for it".
The document did not select a visual direction.

Two facts were true at the same time:

- `apps/web-app/src/App.css` is one file of 1033 lines, with 164 class rules for single uses.
  It *does* declare a block of tokens (lines 6–52).
  But these tokens are local to the app, and they have no system.
  Examples are `--bg-primary`, `--accent-color`, and hex values that a person selected by hand. There is no component layer above them.
  Each surface makes its own decision about spacing, weight, and border.
- A complete design system already existed outside the repository.
  It was a claude.ai/design project. The project used the shadcn/ui codebase as its source (`style: radix-nova`, `baseColor: neutral`, `iconLibrary: lucide`).

The project found that this design system was unusually easy to adopt in this app.
Its components are plain React with plain CSS classes (`<button class="ds-btn" data-variant="…">`).
They use **no Tailwind, no Radix, and no `cva`**.
The design system needs no new packages in an app with Vite and plain CSS. Also, `lucide-react` is already a dependency.

The two visual styles cannot be combined.
The current appearance uses an indigo glow, a gradient wordmark, and radial gradients in the background.
The design system does not permit any of the three ("separation comes from 1px rings and muted fills, never from shadows or color").
Thus, the project had to make a choice. It could not merge the two styles.

## Decision

Adopt the **complete** design system. It becomes the only design reference for `apps/web-app/src/**`.
It replaces the current "Premium Dark" style.

| Item | Choice |
| --- | --- |
| Source | The claude.ai/design project `Shadcn`, ID `3e9943b6-fb13-4931-bb8e-09f11a035088` |
| Delivery | **Vendored** into `apps/web-app/src/styles/ds/`. The project gets the files with the `DesignSync` tool. The design system is not an npm dependency. |
| Accent | `theme-indigo`. Its hue is near the hue of the old accent `#6366f1`. Thus, users still recognize the product. |
| Modes | Light **and** dark. The user can change between them. The design system includes both palettes. |
| Graph nodes | The node style comes from the `Card` tokens (radius, border, surface). The design system has no graph component. |
| Extensions | The project adds `--success` and `--warning`. They follow the `--destructive` pattern of the design system: a background with a 10% tint, and text at full strength. |
| Icons | Only lucide. The project removes the emoji glyphs in `PlaybackBar.tsx` (`⏮ ⏸ ▶ ⏹ ✕`) and `NodeInspector.tsx` (`◎`, `⚠`). |

The migration is incremental. It is not a rewrite.
A bridge file sets the legacy variables to the tokens of the design system, for example `--bg-primary: var(--background)`.
Thus, the existing 1033 lines continue to work with no change, while the project converts the surfaces one at a time.
The definition of "migration complete" is this: the bridge file is empty.
[`../design/direction.md`](../design/direction.md) contains the plan and its stages.

## Consequences

### Advantages

- **A token layer and a component layer that the project did not have to design.**
  An existing system with consistent rules answers the open questions in `direction.md`.
  These questions are light or dark, the component for the numeric tables, and the appearance of destructive states.
- **Light and dark modes with no design work.** The design system defines both palettes. The project must build only the toggle.
- **Components that you can review against written rules.** Each component has a `.prompt.md` file beside it.
  The file tells what the component is and gives its important rules.
  Thus, a reviewer can compare a change with written rules.
- **No new packages.** Thus, the build, the bundle strategy, and the pipeline for the WASM assets do not change.
- The inspector gets a real `Table`: 40px header cells, 8px body cells, and very thin lines between the rows.
  This matches constraint #4 of `direction.md` ("numbers are the payload").

### Disadvantages

- **The project removes the current visual identity intentionally.**
  The gradient wordmark, the accent glow, and the radial gradients in the background all go.
  A person who expects the current appearance to stay will think that this change is a regression.
- **The fonts become a third-party runtime dependency.**
  The design system loads Geist and Geist Mono from Google Fonts with `@import`.
  This *does* work with the COEP `require-corp` of [`0002`](./0002-coep-require-corp.md). A check on 2026-08-22 verified it:
  - `fonts.googleapis.com` and `fonts.gstatic.com` both return `cross-origin-resource-policy: cross-origin`. This header satisfies the policy.
  - In production, the deployed build already imports Outfit and JetBrains Mono, and these fonts load correctly.

  The disadvantage is the dependency itself.
  If the app cannot get to Google Fonts, or if Google Fonts stops sending CORP, the app shows the fallback fonts.
  Self-hosted `.woff2` files remove this dependency. This is an option, not a requirement.
- **The project must port the components to `.tsx`.**
  The components come as `.jsx` and `.d.ts` files.
  `tsconfig.app.json` does not set `allowJs`, and `npm run build` runs `tsc -b`.
  The project prefers to port only the components that it uses, instead of enabling `allowJs`.
  `allowJs` would also cause `noUnusedLocals` errors on 35 unused components.
- **The design system is compact, and the app was not.**
  The default control height is 32px. The default font size of the product is 14px.
  The density of the inspector and the density of the sidebar both change.
- **The vendored copy becomes different from the source.**
  The copy in the repository does not change when the upstream project changes.
  To synchronize again, a person uses `DesignSync` intentionally. `npm update` does not do it.
- **The project must maintain two items itself:** the `success`/`warning` tokens and the graph node style.
  The upstream system does not have these items, and it will not validate them.
- Inline styles in `NodeInspector.tsx` hardcode `rgba(255,255,255,0.08)` and similar values.
  The bridge does not change them. The project must convert each of them separately.

## Other options

- **Keep the current appearance, and extract a token layer of our own.**
  This option costs the least. It was also the plan that the next steps of `direction.md` suggested.
  The project rejected it. It solves the token problem.
  But the real complaint stays the same: the interface has no point of view.
  Also, it makes the project design and maintain a component layer by hand.
- **Install shadcn/ui correctly with its CLI.**
  This option adds Tailwind v4, Radix primitives, and `cva` to a project that uses plain CSS intentionally.
  The project already has these components in plain form.
  The project rejected this option. It is a large change to the dependencies, and it gives no new capability.
- **Use the design system only as a reference, and copy the values by hand.**
  The project rejected this option. The copy becomes different from the source immediately.
  It also removes the `.prompt.md` rules. These rules let a reviewer examine the components.
- **A hybrid: the design system for the UI around the canvas, and the current appearance for the canvas.**
  Constraint #2 of `direction.md` can justify this option.
  But it puts two visual styles on one screen. Also, a person must make a decision at each boundary.

## Open questions

- Where does the app keep the theme state: in `uiStore` with `localStorage`, or in `prefers-color-scheme` with an override?
  No other part of the app saves a user preference yet.
- Is the graph canvas easy to read in light mode?
  The project adjusted the ReactFlow edges, the minimap, and the selection highlight for an almost black background.
- Should the project add the graph node component to the upstream design system when the component is stable?
  Then the two stay consistent.

# 0003. Adopt the Shadcn design system wholesale for the web app

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

[`../design/direction.md`](../design/direction.md) recorded that the interface "reads as
generic — the default shape a tool takes when no one has chosen a point of view for it",
and left the visual direction open.

Two things were true at the same time:

- `apps/web-app/src/App.css` is a single 1033-line file with 164 one-off class rules. It
  *does* declare a token block (lines 6–52), but those tokens are app-local and ad hoc:
  `--bg-primary`, `--accent-color`, hand-picked hex values, no component layer above them.
  Every surface re-decides its own spacing, weight and border.
- A finished design system already existed outside the repository — a claude.ai/design
  project built from the shadcn/ui codebase (`style: radix-nova`, `baseColor: neutral`,
  `iconLibrary: lucide`).

That design system turned out to be unusually cheap to adopt here: its components are
plain React plus plain CSS classes (`<button class="ds-btn" data-variant="…">`), with **no
Tailwind, no Radix, and no `cva`**. It needs zero new packages in a Vite + vanilla-CSS app,
and `lucide-react` is already a dependency.

The two visual languages cannot be blended. The current look is built on an indigo glow,
a gradient wordmark and radial background washes; the design system forbids all three
("separation comes from 1px rings and muted fills, never from shadows or color"). A choice
was required rather than a merge.

## Decision

Adopt the design system **wholesale** as the single source of truth for
`apps/web-app/src/**`, replacing the current "Premium Dark" treatment.

| | |
| --- | --- |
| Source | claude.ai/design project `Shadcn`, id `3e9943b6-fb13-4931-bb8e-09f11a035088` |
| Delivery | **Vendored** into `apps/web-app/src/styles/ds/`, read via the `DesignSync` tool — not an npm dependency |
| Accent | `theme-indigo` — the same hue family as the outgoing `#6366f1`, so the product still reads as itself |
| Modes | Light **and** dark, user-togglable. The design system ships both palettes |
| Graph nodes | Derived from the `Card` tokens (radius, border, surface). The design system has no graph primitive |
| Extensions | `--success` and `--warning` are added, following the design system's own `--destructive` pattern (10% tint background, full-strength text) |
| Icons | lucide only. The emoji glyphs in `PlaybackBar.tsx` (`⏮ ⏸ ▶ ⏹ ✕`) and `NodeInspector.tsx` (`◎`, `⚠`) are removed |

Migration is incremental, not a rewrite. A bridge file re-points the legacy variables at
design-system tokens (`--bg-primary: var(--background)` and so on), so the existing 1033
lines keep working untouched while surfaces are converted one at a time. The bridge
shrinking to nothing is the definition of "migration complete". The staged plan lives in
[`../design/direction.md`](../design/direction.md).

## Consequences

### What this buys

- **A token layer and a component layer, neither of which had to be designed.** The open
  questions in `direction.md` — light vs dark, what carries the numeric tables, how
  destructive states look — are answered by an existing, internally consistent system.
- **Light and dark for free.** Both palettes are defined; only the toggle is ours to build.
- **Judgeable components.** Every component ships a sibling `.prompt.md` stating what it is
  and the rules that matter, so a change can be reviewed against something written down.
- **No new packages**, so no change to the build, the bundle strategy, or the WASM asset
  pipeline.
- The inspector gets a real `Table` — 40px header cells, 8px body cells, hairline rows —
  which matches `direction.md` constraint #4 ("numbers are the payload").

### What this costs

- **The current visual identity is abandoned**, deliberately. The gradient wordmark, the
  accent glow and the radial background washes all go. Anyone expecting the existing look
  to survive will read this as a regression.
- **Type becomes a third-party runtime dependency.** The design system loads Geist and
  Geist Mono from Google Fonts via `@import`. This *does* work under
  [`0002`](./0002-coep-require-corp.md)'s COEP `require-corp` — verified 2026-08-22:
  both `fonts.googleapis.com` and `fonts.gstatic.com` return
  `cross-origin-resource-policy: cross-origin`, which satisfies the policy, and the
  deployed build's existing Outfit / JetBrains Mono import is loading fine in production.
  The cost is the dependency itself: the app renders in fallback type if Google Fonts is
  unreachable or ever stops sending CORP. Self-hosting the `.woff2` files removes that,
  and is an option rather than a prerequisite.
- **Components must be ported to `.tsx`.** They ship as `.jsx` + `.d.ts`, and
  `tsconfig.app.json` sets no `allowJs` while `npm run build` runs `tsc -b`. Porting only
  what is used is preferred to enabling `allowJs`, which would also trip `noUnusedLocals`
  on 35 unused components.
- **The system is compact, and the app was not.** Default control height is 32px and the
  product default type size is 14px. Inspector and sidebar density both shift.
- **Vendoring means drift.** The copy in the repository does not follow the upstream
  project. Re-syncing is a deliberate act through `DesignSync`, not `npm update`.
- **Two gaps are ours to maintain**: the `success`/`warning` tokens and the graph node
  style. Both are additions the upstream system does not have and will not validate.
- Inline styles in `NodeInspector.tsx` hardcode `rgba(255,255,255,0.08)` and similar. The
  bridge does not reach them; they need individual conversion.

## Alternatives considered

- **Keep the current look, extract our own token layer.** Cheapest, and it was the plan
  implied by `direction.md`'s next steps. Rejected: it solves the token problem and leaves
  the actual complaint — that the interface has no point of view — exactly where it was,
  while committing us to designing and maintaining a component layer by hand.
- **Install shadcn/ui properly via its CLI.** Brings Tailwind v4, Radix primitives and
  `cva` into a project that is deliberately vanilla CSS, for components we already have in
  plain form. Rejected as a large dependency change bought for no additional capability.
- **Use the design system as reference only**, hand-copying values. Rejected: it recreates
  drift immediately and discards the `.prompt.md` rules that make components reviewable.
- **Hybrid — design system for the chrome, current look for the canvas.** Defensible under
  `direction.md` constraint #2, but leaves two visual languages on one screen and forces a
  judgement call at every boundary.

## Open questions

- Where does theme state live — `uiStore` with `localStorage`, or `prefers-color-scheme`
  with an override? Nothing else in the app persists user preference yet.
- Is the graph canvas legible in light mode? ReactFlow edges, the minimap and the selection
  highlight were all tuned against a near-black background.
- Should the graph node component be pushed back up to the design system once it settles,
  so the two stay in step?

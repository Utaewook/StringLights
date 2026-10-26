# Vendored design system

This directory contains the tokens and the styles of the **Shadcn** design system.
The style is shadcn/ui `radix-nova`, with the neutral base color.
[ADR 0003](../../../../docs/decisions/0003-adopt-shadcn-design-system.md) records the decision.

| Item | Value |
| --- | --- |
| Source | claude.ai/design project `Shadcn` |
| Project id | `3e9943b6-fb13-4931-bb8e-09f11a035088` |
| How to read the source | The `DesignSync` tool: `list_files`, then `get_file` |
| Vendored on | 2026-08-22 |

This directory is a **copy**, not a dependency. It does not update itself.
To synchronize it again, use `DesignSync`. Do not use `npm update`.

## Contents

`tokens/` is the same as the source, with one reduction:

- `tokens/themes.css` contains **only `theme-indigo`**. The source has fifteen accent themes, but this product uses one. If the accent changes, get the other theme with `DesignSync`.

`styles/base.css` and `styles/components.css` are the same as the source.
`components.css` is the plain CSS of all components in the system. It also contains the components that this app does not use.
Keep the file complete. Then a new synchronization is a copy, not a merge.

`extensions.css` is **ours**. It is not part of the source. It contains these items:

- the `--ds-success` and `--ds-warning` tokens, which the design system does not define,
- the badge variants and the alert variant for these tokens,
- one layout utility (`.ds-btn-block`),
- a reset for links with button styles (`a.ds-btn`). See the "What we add on top" section of [`direction.md`](../../../../docs/design/direction.md).

Keep `extensions.css` separate. Then a new synchronization does not have to merge it.
`index.css` imports it last. Thus, its component variants come after the styles that they extend.

## Items outside this directory

`../bridge.css` is a temporary map from the old `App.css` variables to these tokens.
It is application code, not design system code. The project wants to make it empty and delete it. See the comment at the top of the file.

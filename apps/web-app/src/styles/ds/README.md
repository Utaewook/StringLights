# Vendored design system

Tokens from the **Shadcn** design system (shadcn/ui `radix-nova` style, neutral base),
adopted by [ADR 0003](../../../../docs/decisions/0003-adopt-shadcn-design-system.md).

| | |
| --- | --- |
| Source | claude.ai/design project `Shadcn` |
| Project id | `3e9943b6-fb13-4931-bb8e-09f11a035088` |
| How to read the source | The `DesignSync` tool — `list_files`, then `get_file` |
| Vendored on | 2026-08-22 |

This is a **copy**, not a dependency. It does not update itself. Re-syncing is a
deliberate act through `DesignSync`, not `npm update`.

## What is here

`tokens/` is verbatim from the source, with two deliberate reductions:

- `tokens/themes.css` carries **only `theme-indigo`**. The source ships fifteen accent
  themes; this product uses one. Pull another with `DesignSync` if the accent is revisited.
- `styles/base.css` and `styles/components.css` are **not** vendored yet. They arrive in
  Phase 2, when components start being converted. Importing the resets early would fight
  the existing `index.css` and `App.css` for no benefit.

`extensions.css` is **ours**, not the source's — the `--success` and `--warning` tokens the
design system does not define. Keep it separate so a re-sync never has to merge it.

## What is not here

`../bridge.css` — the temporary mapping from the legacy `App.css` variables onto these
tokens. It is application code, not design system code, and it is meant to shrink to
nothing. See its header comment.

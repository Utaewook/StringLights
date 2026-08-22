# StringLights Documentation

Every artifact has exactly one home. Choose the directory by **what the document is**,
not by what it is about.

| Directory | Holds | Lifecycle |
| --- | --- | --- |
| [`guide/`](./guide/) | Settled norms: overview, terminology, architecture, conventions | Stable. Changes only when a decision supersedes it. |
| [`decisions/`](./decisions/) | ADRs — a choice together with the trade-off it accepted | Written once at decision time, then immutable |
| [`issues/`](./issues/) | Open problems, one file each | `Status` field is updated in place |
| [`history/`](./history/) | Post-mortems of **resolved** problems | Append-only, never edited |
| [`design/`](./design/) | UI/UX direction, references, mockups | Living document |

## The one rule that keeps this from rotting

**`guide/` describes what is true. It must never describe what is planned.**

Anything unfinished belongs in `issues/`, anything contested belongs in `decisions/`,
anything aspirational belongs in `design/`. When a `guide/` document disagrees with the
code, the code is the source of truth and the document is the bug.

## Language

All `.md` files in this repository are **English-only**, including working notes and
issue write-ups. This keeps the repository open to outside contributors and reduces the
context cost of the documents that agents load on every session.

Discuss in whatever language is comfortable; commit in English.

## Naming

| Directory | Pattern | Example |
| --- | --- | --- |
| `guide/` | `NN_snake_case.md` | `03_architecture.md` |
| `decisions/` | `NNNN-kebab-case.md` | `0001-promote-all-intermediate-outputs.md` |
| `issues/` | `NNN-kebab-case.md` | `001-model-load-hang.md` |
| `history/` | `YYYY-MM-DD-<type>-<slug>.md` | `2026-06-13-error-vite-wasm-import.md` |
| `design/` | free-form | `direction.md` |

Issue and ADR file paths are permanent. Closing an issue changes its `Status` field —
it never moves or gets renamed, so links from commits and ADRs stay valid.

## Related

- [`../CLAUDE.md`](../CLAUDE.md) — session rules and trigger routing
- [`guide/04_convention.md`](./guide/04_convention.md) — coding and Git conventions

# Architecture Decision Records

One file per decision that is hard to reverse. An ADR records **the trade-off that was
accepted**, not just the outcome — the outcome is already visible in the code.

An ADR is written once and then left alone. If a decision is later changed, write a new
ADR and mark the old one `Superseded by NNNN`.

## Status values

`Proposed` · `Accepted` · `Superseded by NNNN` · `Deprecated`

## Index

| ID | Decision | Status |
| --- | --- | --- |
| [0001](./0001-promote-all-intermediate-outputs.md) | Promote every intermediate node to a graph output | Accepted |
| [0002](./0002-coep-require-corp.md) | Enable cross-origin isolation via COEP `require-corp` | Accepted |

## Template

```markdown
# NNNN. <Decision in one line>

- **Status:** Accepted
- **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
### What this buys
### What this costs
## Alternatives considered
## Open questions
```

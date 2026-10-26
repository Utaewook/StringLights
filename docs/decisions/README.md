# Architecture Decision Records

Each file in this directory records one decision that is difficult to reverse.
An ADR records the trade-off that the project accepted. The code already shows the result.

Write an ADR one time. Then do not change it.
If the project changes the decision, write a new ADR. Then set the status of the old ADR to `Superseded by NNNN`.

## Status values

`Proposed` · `Accepted` · `Superseded by NNNN` · `Deprecated`

## Index

| ID | Decision | Status |
| --- | --- | --- |
| [0001](./0001-promote-all-intermediate-outputs.md) | Promote all intermediate tensors to graph outputs | Accepted |
| [0002](./0002-coep-require-corp.md) | Enable cross-origin isolation with COEP `require-corp` | Accepted |
| [0003](./0003-adopt-shadcn-design-system.md) | Adopt the Shadcn design system wholesale for the web app | Accepted |

## Template

Write the ADR in ASD-STE100 English. See [`../guide/06_writing_standard.md`](../guide/06_writing_standard.md).

| Section | Contents |
| --- | --- |
| Context | The problem, and the facts that were true at the time of the decision |
| Decision | The choice, in one or two sentences |
| Advantages | The advantages of the choice |
| Disadvantages | The disadvantages that the project accepts |
| Other options | The other options, and the reason that the project did not select them |
| Open questions | The questions that the decision does not answer |

```markdown
# NNNN. <Decision in one line>

- **Status:** Accepted
- **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
### Advantages
### Disadvantages
## Other options
## Open questions
```

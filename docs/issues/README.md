# Issues

Open problems tracked as flat files. A file's path never changes — closing an issue
updates its `Status` field so that references from commits and ADRs stay valid.

## Status values

| Status | Meaning |
| --- | --- |
| `Open` | Confirmed, not yet fixed |
| `Investigating` | Root cause not yet established |
| `Blocked` | Waiting on an external decision or dependency |
| `Closed` | Fixed. A post-mortem may exist in [`../history/`](../history/) |

## Severity values

| Severity | Meaning |
| --- | --- |
| `Critical` | Blocks public launch, or breaks the core flow |
| `High` | Wrong behaviour visible to users |
| `Medium` | Correctness or hygiene issue with no direct user impact |
| `Low` | Cosmetic or speculative |

## Index

| ID | Title | Status | Severity |
| --- | --- | --- | --- |
| [001](./001-model-load-hang.md) | Model load hangs after graph surgery | Investigating | Critical |
| [002](./002-tensor-std-always-zero.md) | Per-node standard deviation is always reported as 0 | Open | High |
| [003](./003-diagnostic-console-logs.md) | Diagnostic `console.*` calls left in shipped code | Open | Medium |
| [004](./004-gitignore-misses-backend-temp-dir.md) | `.gitignore` no longer matches the backend temp directory | Open | Medium |

## Template

```markdown
# <Imperative, English title>

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** YYYY-MM-DD
- **Related:** ../decisions/NNNN-<slug>.md

## Symptom
## Evidence
## Suspected cause
## Impact
## Resolution criteria
```

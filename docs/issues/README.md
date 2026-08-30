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
| [005](./005-input-tensor-dtype-mismatch.md) | Model inputs are built with TypedArrays that do not match their dtype | Open | High |
| [006](./006-opset-ceiling-rejects-runnable-models.md) | Opset ceiling of 21 rejects models the client could run | Open | Medium |
| [007](./007-zip-extraction-has-no-size-limit.md) | ZIP extraction has no decompressed-size limit | Open | High |
| [008](./008-ci-runs-no-tests.md) | CI runs no tests | Open | Medium |
| [009](./009-worker-failures-bypass-error-channel.md) | Worker failures outside the message channel are invisible to the UI | Open | High |
| [010](./010-subgraph-nodes-never-surfaced.md) | Nodes inside If/Loop/Scan subgraphs are never surfaced | Open | Medium |
| [011](./011-surgery-blocks-the-event-loop.md) | Graph surgery blocks the event loop and has no time bound | Open | High |
| [012](./012-upload-intake-is-unbounded.md) | Upload intake is unbounded before the size and concurrency limits apply | Open | Medium |
| [013](./013-error-responses-leak-internals.md) | Error responses return raw exception strings | Open | Low |
| [014](./014-toolchain-versions-drift.md) | Toolchain versions drift between local, Docker, and CI | Open | Medium |
| [015](./015-tls-renewal-has-no-working-path.md) | TLS certificate renewal has no working path | Open | Critical |
| [016](./016-deploys-cannot-be-rolled-back.md) | Deploys cannot be rolled back | Open | High |

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

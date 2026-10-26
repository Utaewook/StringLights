# Issues

Each file in this directory records one problem.
The path of a file does not change.
When you close an issue, change its `Status` field. Do not move or rename the file.
Then the links from commits and ADRs continue to work.

## Status values

| Status | Meaning |
| --- | --- |
| `Open` | The problem is confirmed. Nobody fixed it yet. |
| `Investigating` | The root cause is not known yet. |
| `Blocked` | The work waits for an external decision or an external dependency. |
| `Closed` | The problem is fixed. A post-mortem can be in [`../history/`](../history/). |

## Severity values

| Severity | Meaning |
| --- | --- |
| `Critical` | The problem blocks the public launch, or it breaks the core flow. |
| `High` | Users see wrong behavior. |
| `Medium` | The problem is in correctness or code hygiene. Users do not see it directly. |
| `Low` | The problem is cosmetic, or it is possible but not confirmed. |

## Track values

| Track | Meaning |
| --- | --- |
| `Bug` | The app gives a wrong result, fails, or stops. |
| `Chore` | The problem is in the code, the tooling, or the process. The app gives correct results. |
| `Feature` | The app works correctly, but it does not do something that it must do. |

## Index

| ID | Title | Status | Severity |
| --- | --- | --- | --- |
| [001](./001-model-load-hang.md) | Model load hangs after graph surgery | Closed | Critical |
| [002](./002-tensor-std-always-zero.md) | Per-node standard deviation is always reported as 0 | Closed | High |
| [003](./003-diagnostic-console-logs.md) | Diagnostic `console.*` calls left in shipped code | Closed | Medium |
| [004](./004-gitignore-misses-backend-temp-dir.md) | `.gitignore` no longer matches the backend temp directory | Closed | Medium |
| [005](./005-input-tensor-dtype-mismatch.md) | Model inputs are built with TypedArrays that do not match their dtype | Closed | High |
| [006](./006-opset-ceiling-rejects-runnable-models.md) | Opset ceiling of 21 rejects models the client could run | Closed | Medium |
| [007](./007-zip-extraction-has-no-size-limit.md) | ZIP extraction has no decompressed-size limit | Closed | High |
| [008](./008-ci-runs-no-tests.md) | CI runs no tests | Open | Medium |
| [009](./009-worker-failures-bypass-error-channel.md) | Worker failures outside the message channel are invisible to the UI | Closed | High |
| [010](./010-subgraph-nodes-never-surfaced.md) | Nodes inside If/Loop/Scan subgraphs are never surfaced | Closed | Medium |
| [011](./011-surgery-blocks-the-event-loop.md) | Graph surgery blocks the event loop and has no time bound | Closed | High |
| [012](./012-upload-intake-is-unbounded.md) | Upload intake is unbounded before the size and concurrency limits apply | Closed | Medium |
| [013](./013-error-responses-leak-internals.md) | Error responses return raw exception strings | Closed | Low |
| [014](./014-toolchain-versions-drift.md) | Toolchain versions drift between local, Docker, and CI | Closed | Medium |
| [015](./015-tls-renewal-has-no-working-path.md) | TLS certificate renewal has no working path | Closed | Critical |
| [016](./016-deploys-cannot-be-rolled-back.md) | Deploys cannot be rolled back | Closed | High |
| [017](./017-non-batch-dynamic-axes-are-guessed.md) | Non-batch dynamic axes are guessed as 1 | Closed | Medium |
| [018](./018-inference-memory-is-unbounded.md) | Inference memory is bounded only per input, and not at all on the output side | Closed | High |
| [019](./019-loaded-model-bytes-are-never-read.md) | The uploaded model is kept in the store and never read | Open | Low |
| [020](./020-replay-steps-one-node-at-a-time.md) | Replay steps one node at a time, even through independent branches | Open | Low |

## Template

Write the issue in ASD-STE100 English. See [`../guide/06_writing_standard.md`](../guide/06_writing_standard.md).

- **Title:** Write the problem as a statement. Example: "Model load hangs after graph surgery".
- **Resolution:** Add this section when you close the issue. Tell what changed and how you verified it.

```markdown
# <The problem, as a statement>

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
## Resolution (YYYY-MM-DD)
```

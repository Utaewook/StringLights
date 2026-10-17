# Inference memory is bounded only per input, and not at all on the output side

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-09-21
- **Related:** [009](./009-worker-failures-bypass-error-channel.md), [017](./017-non-batch-dynamic-axes-are-guessed.md), [../decisions/0001-promote-all-intermediate-outputs.md](../decisions/0001-promote-all-intermediate-outputs.md)

## Symptom

No symptom has been observed. A test run can ask the browser for more memory than
the tab has, and the likely outcome is the tab being killed outright. That failure
reaches no error handler, so it is invisible to the error paths added in
[009](./009-worker-failures-bypass-error-channel.md): the page simply dies.

## Evidence

There is one limit, and it is on the input side:

```ts
// apps/web-app/src/utils/modelInputs.ts:66-67
/** ~256MB as float32. Past this the tab dies before onnxruntime sees anything. */
const MAX_ELEMENTS = 64 * 1024 * 1024;
```

It has four gaps.

1. **It counts elements, not bytes.** The comment's 256MB holds for float32
   only. `float64`, `int64` and `uint64` are 8 bytes wide, so the same limit
   admits 512MB.
2. **It applies per input.** The check at `modelInputs.ts:112` runs inside the
   loop over inputs, and nothing sums across them. A model with three inputs can
   request three times the limit.
3. **The batch size ceiling is not enforced.** `max={512}` on the batch input
   (`InferencePanel.tsx:279`) is an HTML attribute, and typed input is not bound
   by it. The handler at `InferencePanel.tsx:281` clamps the minimum only:

   ```tsx
   onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value)))}
   ```

4. **Every input exists more than once.** It is built on the main thread, copied
   into the worker by `postMessage` without a transfer list
   (`WorkerContext.tsx:252`), and copied again into the WASM heap by onnxruntime.
   A 256MB input costs a multiple of that.

The output side has no limit at all, and it is the larger term. Surgery promotes
every intermediate tensor to a graph output (`surgery.py:338`, per
[ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md)), so one run
returns every activation in the model. The worker then posts all of them to the
main thread without a transfer list (`ort-worker.ts:100`), which copies them
again. For a convolutional model, activations grow with batch size and can sum to
several gigabytes while the input stays well inside `MAX_ELEMENTS`.

Nothing can check this before the run today. The metadata surgery returns carries
shape and dtype for model inputs only; for outputs it carries names
(`outputNames`, `intermediateOutputNames`) and nothing else.

## Suspected cause

The limit was written to stop one oversized allocation on the path it could see,
building an input. The cost of promoting every activation was accepted in
ADR 0001 as a trade for one round trip per model, but no budget was ever set for
the memory that trade spends on the client.

## Impact

A user who raises the batch size on a medium-sized CNN can lose the tab with no
message. Nothing is recorded, so the report would be "the page crashed" with no
detail. It also caps what the [009](./009-worker-failures-bypass-error-channel.md)
follow-up can promise: a watchdog that terminates a stalled worker cannot help
once the whole tab is gone.

## Resolution criteria

1. The batch size is clamped in code, not only by the input's `max` attribute.
2. The input limit is a byte budget summed over all inputs, using each dtype's
   element size, so the documented figure is the enforced one.
3. Surgery metadata carries shape and dtype for every promoted output, so the
   client can size a run before starting it.
4. Before a run, the client estimates the total bytes of inputs plus returned
   outputs at the chosen batch size, and refuses or warns above a stated budget.
   The budget and its rationale are recorded.
5. Criteria 1, 2 and 4 are covered by tests in `src/utils/`, which now has a
   runner ([008](./008-ci-runs-no-tests.md)).

Transferring buffers instead of copying them in `postMessage` would lower the
cost of every run, and is worth doing alongside, but it is not a bound and does
not meet any criterion above.

## Design (2026-10-17)

### Measured first

A VGG-shaped CNN was built to put numbers on the output side — four
`Conv -> Relu -> MaxPool` stages on `[N, 3, 224, 224]`, then
`GlobalAveragePool -> Flatten`. 14 nodes, **940 KB on disk**, because the weights
are small and the activations are not.

| batch | input | activations returned | ratio |
| --- | --- | --- | --- |
| 1 | 0.6 MB | **25.0 MB** | 43.5x |
| 8 | 4.6 MB | **199.8 MB** | 43.5x |
| 32 | 18.4 MB | **799.3 MB** | 43.5x |

The input is 150,528 elements per batch item, so the current `MAX_ELEMENTS`
ceiling of 67,108,864 admits **batch 445** — about **11 GB** of returned
activations, each buffer existing roughly three times over. The existing limit
does not merely measure the wrong side; at this shape it does not bind at all.

The three real models in the owner's `~/Desktop/models/` show the same asymmetry
in miniature: output-to-input ratios of 102.8x (`gan_generator`) and 257.0x
(`vae_decoder`). The ratio is a property of the model, not a constant, which is
why criterion 3 is a prerequisite rather than a convenience — the client cannot
guess it.

### The budget: 512 MB of returned tensors, fixed

```ts
/** Total bytes of inputs plus returned activations for one run. */
const MAX_RUN_BYTES = 512 * 1024 * 1024;
```

Each tensor exists about three times: built on the main thread, copied into the
worker, and copied again into onnxruntime's WASM heap. 512 MB of tensors is
therefore roughly 1.5 GB of real footprint, which is near what a tab can carry
without being killed.

**Fixed rather than derived from `navigator.deviceMemory`.** A device-derived
budget would admit larger batches on larger machines, and would make the same
model, at the same batch size, succeed for one person and fail for another. For
a debugging tool, a bug report that cannot be reproduced on a colleague's laptop
costs more than the batches the fixed number turns away. `deviceMemory` is also
Chrome-only and clamped to 8, so it is a coarse hint rather than a measurement.

The number is a stated budget, not a prediction. Its job is to turn a silent tab
death into a sentence.

### Over budget: refuse, and say which batch size fits

Total bytes are affine in the batch size — each output contributes
`width x (product of its non-batch dims) x (batch, if it has a batch axis)` — so

```
bytes(batch) = fixed + perItem * batch
largestFittingBatch = floor((MAX_RUN_BYTES - fixed) / perItem)
```

is exact, not a search. The run is blocked and the UI states the estimate, the
budget, and the batch size that fits:

```
This run would return 2.4 GB of activations, above the 512 MB budget.
Batch size 6 fits (480 MB).
```

Refusing rather than warning: a killed tab loses the loaded model, the graph, and
every activation already inspected. "Run anyway" offers the user a choice whose
downside is losing all their work, with no way to know in advance which side of
the line their machine sits on.

Showing the estimate is not only for the refusal — **it is displayed for every
run**, which is also the cheap half of
[017](./017-non-batch-dynamic-axes-are-guessed.md): once the resolved shapes are
on screen, a dynamic axis that was guessed as 1 is visible rather than silent.

### Changes

| criterion | change | where |
| --- | --- | --- |
| 3 | `extract_graph_meta` gains `outputs: [{name, dtype, shape}]`, built from `graph.output` with the existing `_get_tensor_meta` | `apps/backend/app/services/surgery.py` |
| 1 | `MAX_BATCH_SIZE` constant shared with the input's `max` attribute; `onChange` clamps both ends and guards `NaN` | `features/inference/InferencePanel.tsx` |
| 2 | `MAX_ELEMENTS` replaced by a byte budget summed across all inputs, using each dtype's width | `utils/modelInputs.ts` |
| 4 | `estimateRunBytes(inputs, outputs, batchSize)` and `largestFittingBatch(...)` | new `utils/runBudget.ts` |
| 4 | the estimate rendered beside the batch control; run disabled when over | `features/inference/InferencePanel.tsx` |
| 5 | tests for 1, 2 and 4 | `src/utils/*.test.ts` |

Criterion 3 is close to free. Each entry in `graph.output` is a `ValueInfoProto`
already carrying `elem_type` and `shape` — surgery promotes those very objects —
so the same `_get_tensor_meta` the inputs use applies unchanged. Tensors that
could not be promoted are absent from `graph.output`, so they are excluded
without a special case.

Criterion 2's input budget stays inside `modelInputs.ts` even though criterion 4
covers inputs too. That module is the one that allocates; it has to bound itself
regardless of what its caller checked.

### Also in scope: transferring instead of copying

`postMessage` is called eight times across `ort-worker.ts` and
`WorkerContext.tsx`, none with a transfer list. The worker-to-main post of every
activation (`ort-worker.ts:100`) is the largest copy in the system, and the
worker discards those buffers immediately afterwards, so detaching them is safe.

This is not a bound and meets no criterion above. It is included because it
touches the same two files as the budget work and halves the cost of every run
that the budget admits.

### Not in scope

Reducing what surgery returns — streaming activations, returning them on demand,
or promoting a subset. That would revisit
[ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md), whose trade
(one round trip per model, every activation in hand) is deliberate and not what
this issue disputes. This issue bounds the cost of that trade; it does not
renegotiate it.

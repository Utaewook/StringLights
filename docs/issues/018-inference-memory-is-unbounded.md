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

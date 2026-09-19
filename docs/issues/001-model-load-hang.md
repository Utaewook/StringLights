# Model load hangs after graph surgery

- **Status:** Closed
- **Severity:** Critical
- **Track:** Bug
- **Found:** 2026-07 (diagnostics added in commit `870c4ec`)
- **Related:** [../decisions/0001-promote-all-intermediate-outputs.md](../decisions/0001-promote-all-intermediate-outputs.md)

## Symptom

After the backend returns a surgically modified model, the frontend can hang while
creating the `InferenceSession` instead of failing with an error. The UI stays in the
loading state indefinitely.

## Evidence

Commit `870c4ec` (*"add console logging to diagnose model load hangs"*) added tracing to
`WorkerContext.tsx` and `ort-worker.ts`. Those diagnostics are **still present in the
tree**, which indicates the investigation was never concluded.

## Suspected cause

`apps/backend/app/services/surgery.py:225-232` — when shape inference produces no
`value_info` for a node output, the fallback registers the tensor as a graph output with
an undefined type and no shape:

```python
inferred_model.graph.output.append(
    helper.make_tensor_value_info(out_name, onnx.TensorProto.UNDEFINED, None)
)
```

ONNX Runtime may not be able to plan execution for a graph output whose element type is
`UNDEFINED`. This is a hypothesis, not a confirmed root cause.

A second, independent candidate is memory pressure from promoting every intermediate
node to a graph output — see the linked ADR.

## Impact

Blocks public launch. Any traffic sent to the site before this is resolved lands on a
product that may never finish loading a model.

## Resolution criteria

1. Root cause confirmed with a reproducing model, and recorded in `../history/`.
2. Graph surgery either produces well-typed outputs or rejects the tensor explicitly.
3. A failed load surfaces an actionable error in the UI instead of hanging.
4. Diagnostic logging removed — tracked separately as [003](./003-diagnostic-console-logs.md).

## Root cause (2026-08-30)

Established, with evidence outside the browser.

Surgery promoted every intermediate tensor to a graph output. When shape
inference could not type one, it promoted it anyway as
`TensorProto.UNDEFINED` with no shape. That graph is not valid ONNX:

```
UNDEFINED promotion: checker REJECTED -> Field 'shape' of 'type' is required but missing.
typed promotion    : checker ACCEPTED
```

The client had no way to report this. `InferenceSession.create` receives a
structurally invalid graph and the failure surfaces as a stall rather than an
exception — which matches the symptom exactly: the UI stays in its loading state
and no error ever arrives.

## Fix

Two changes, both in `apps/backend/app/services/surgery.py`:

- Tensors shape inference cannot type are no longer promoted. They are reported
  as `unpromotableOutputNames` so the client can say the activation exists but
  cannot be inspected.
- `onnx.checker.check_model` runs before the model is saved, so a graph that
  would fail in the browser fails here as a 400 with a reason attached.

Issue [009](./009-worker-failures-bypass-error-channel.md) covers the other half
of the symptom: the UI is no longer able to sit in a loading state forever
regardless of what causes it.

## Second path to the same invalid graph (2026-09-19)

The guard added above was incomplete. It skipped a tensor when shape inference
produced **no** `value_info`, and promoted it otherwise — but inference can also
return a `value_info` whose element type is resolved and whose shape is not:

```
Loop output 'looped': elem_type=1  HasField(shape)=False
```

Promoting that produces the same unloadable graph, and `onnx.checker` rejects it
with the same message as the UNDEFINED promotion:

```
Field 'shape' of 'type' is required but missing.
```

`Loop` is the ordinary case, and `onnx.checker` accepts such a model as written —
so the defect took a **valid** model and made it unusable. After the checker was
added in the first fix this surfaced as a `400` rather than a hang, which is an
improvement but not what resolution criterion 2 asks for: it rejected the model,
not the tensor.

`_is_promotable` in `surgery.py` now requires a tensor type to carry a shape
before it can become a graph output. The tensor is reported in
`unpromotableOutputNames` and the rest of the model stays usable. Non-tensor
types (sequence, map, optional) are left to the checker — this guard covers the
cases known to be reachable and known to produce an invalid graph.

**Verified** in `build/test.Dockerfile` by `TestLoopOutputPromotion`, five tests
covering: the fixture is valid ONNX to begin with, surgery no longer rejects it,
`looped` is reported rather than promoted, every promoted output carries a shape,
and the saved model passes the checker. Mutation-checked — narrowing the guard
back to `value_info is None` fails four of the five, and the fixture-validity
test correctly keeps passing.

## Candidate models examined (2026-09-19)

Three real models were run through `run_graph_surgery` directly:

| model | opset | nodes | external data | unpromotable |
| --- | --- | --- | --- | --- |
| `ae_model.onnx` | 20 | 10 (`Gemm`×6, `Relu`×4) | yes | 0 |
| `gan_generator.onnx` | 20 | 5 | yes | 0 |
| `vae_decoder.onnx` | 20 | 5 | yes | 0 |

None carries the trigger. They are small MLPs whose every tensor shape inference
types, so the pre-fix code would have produced a valid graph for them too — they
cannot confirm or deny this issue, and the owner confirms none of them is the
model that hung.

Two synthetic reproducers were built instead and kept outside the repository, in
the owner's `~/Desktop/models/`, with a README describing what each triggers:
`issue001-loop-unshaped-output.onnx` (the path above) and
`issue001-custom-domain-op.onnx` (the no-`value_info` path). The authoritative
copies are the `onnx.helper` calls in `TestLoopOutputPromotion`.

## Verified in the browser (2026-09-19)

`issue001-loop-unshaped-output.onnx` was run through the full local stack —
backend surgery, then the browser — which is where the symptom lived:

```
POST /api/surgery                200 OK
graph                            4 nodes (Loop + 2 subgraph + Identity), opset 17
Engine                           Loading... -> WebGPU accelerated
inference                        completed, playback ready
inspector, tensor `looped`       "No data"
```

The `Engine` line is the one that matters. That transition is where the session
used to sit forever. The model loads, runs, and reports the one tensor it cannot
expose, while every other part of it stays usable.

Also confirmed on a real model (`ae_model.onnx`, 10 nodes, external data
inlined, opset 20): surgery, load, inference, and per-node statistics all work
end to end.

## Closed with criterion 1 unmet

Criteria 2, 3 and 4 are met. **Criterion 1 is not, and this issue is closed
anyway** — a decision by the owner on 2026-09-19, recorded here rather than
disguised.

The model that first showed the hang cannot be located and is not among the
three examined above. Criterion 1 asks for the root cause to be confirmed
against a reproducing model, which cannot now happen: there is no path from here
to that evidence, so leaving the issue open would not produce it. What exists
instead is the mechanism reproduced synthetically, fixed, covered by
`TestLoopOutputPromotion`, and exercised in the browser.

That is weaker than what criterion 1 asked for, and the difference is the point
of writing it down. **If a model hangs at session creation again, this issue is
the wrong record to trust** — reopen rather than assume the cause was the one
established here. The two reproducers live in the owner's `~/Desktop/models/`
with a README, and the authoritative copies are the `onnx.helper` calls in
`TestLoopOutputPromotion`.

Criterion 4 (remove the diagnostic logging, tracked as
[003](./003-diagnostic-console-logs.md)) was blocked on this issue, while 003 was
blocked on it in turn — a deadlock in the two write-ups. Closing
[009](./009-worker-failures-bypass-error-channel.md) broke it: worker failures
now produce error text, so the `console.*` tracing was no longer the only
diagnostic. 003 is closed, and a `no-console` lint rule now keeps the next
investigation's tracing from outliving it.

# Model load hangs after graph surgery

- **Status:** Investigating
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

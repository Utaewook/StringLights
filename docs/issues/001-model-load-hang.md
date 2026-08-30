# Model load hangs after graph surgery

- **Status:** Open
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

## Why this stays Open

The cause is established and the trigger is removed, but the original hang was
never reproduced against a specific model, so the fix is not confirmed against
one either. Closing requires loading the model that first showed the symptom and
seeing it either load or fail with a message.

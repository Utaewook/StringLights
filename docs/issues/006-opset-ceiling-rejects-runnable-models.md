# Opset ceiling of 21 rejects models the client could run

- **Status:** Closed
- **Severity:** Medium
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [014](./014-toolchain-versions-drift.md)

## Symptom

Uploading a model exported by a recent version of PyTorch is rejected with
`Unsupported ONNX opset version: NN. Supported range is opset 7–21.` before any surgery
runs, even though the browser-side runtime supports that opset.

## Evidence

The gate is a hard-coded constant:

```python
# apps/backend/app/services/surgery.py:8
SUPPORTED_OPSET_RANGE = (7, 21)
```

```python
# apps/backend/app/services/surgery.py:66-72
lo, hi = SUPPORTED_OPSET_RANGE
if not (lo <= version <= hi):
    raise ValueError(...)
```

The client runs `onnxruntime-web` `^1.26.0` (`apps/web-app/package.json`), which
supports opsets above 21. The ceiling is therefore stricter than the component that
actually executes the graph.

No document records where `21` came from. It is absent from `../decisions/` and from
`../guide/`.

## Suspected cause

The constant appears to track the opset supported by the `onnx` package version present
when it was written, rather than the opset supported by the client runtime. Since this
project never runs inference on the server, the server's own opset support is not the
binding constraint — the browser's is.

Note that the backend does need *some* bound: `onnx.shape_inference.infer_shapes`
operates on the graph and can behave poorly on op versions it does not model. But that
bound is about shape inference, not about executability, and the two have been conflated.

## Impact

Models produced by current tooling are turned away at the door. For a tool whose entire
premise is "bring your own ONNX model", a rejection on export-version grounds is a
first-contact failure — the user has no reason to suspect the file is fine and the
server is out of date.

## Resolution criteria

1. The ceiling is derived from, or justified against, the opset the client runtime
   supports — not left as an unexplained literal.
2. Whatever bound remains has its rationale recorded (a comment naming the constraint,
   or an ADR if the trade-off is real).
3. If shape inference is the actual limitation, failing shape inference degrades to the
   existing best-effort fallback (`surgery.py:207-211`) instead of rejecting the upload.

## Measured, 2026-08-22

The ceiling is not merely stricter than the client — it is stricter than the server's own
library. Queried from the installed backend environment:

```
onnx version       : 1.21.0
max opset (ai.onnx): 26
```

So `21` corresponds to neither component. It is below what `onnx` supports for graph
manipulation *and* below what `onnxruntime-web` supports for execution.

This makes the fix cheaper than the issue originally implied: no external version research
is needed. Deriving the bound from `onnx.defs.onnx_opset_version()` replaces the
unexplained literal with a value that is correct by construction and tracks the installed
package. Note that this only holds once the package is pinned — see
[014](./014-toolchain-versions-drift.md).


## Resolution (2026-09-19)

```python
MIN_SUPPORTED_OPSET = 7
MAX_SUPPORTED_OPSET = onnx.defs.onnx_opset_version()
```

**Criterion 1 — the ceiling is derived.** Surgery is shape inference plus graph
rewriting, and both are `onnx`'s job, so `onnx`'s own support is the real bound on what
this service can process. With the pinned onnx 1.22.0 that is **27**, up from the
literal 21.

**Criterion 2 — the rationale is recorded** in a comment at the constant, including the
part that is a deliberate choice rather than a derivation: *execution is not this
service's gate*. A model this service can rewrite but the browser cannot run now fails
in the browser with a message ([009](./009-worker-failures-bypass-error-channel.md))
instead of being refused at upload. Refusing at the door is the worse outcome — it turns
away models the client would have executed, which is the first-contact failure this
issue was filed about.

**Criterion 3 — shape inference failure already degrades** rather than rejecting.
`run_graph_surgery` falls back to the un-inferred graph, whose tensors then have no
`value_info` and are reported as unpromotable rather than promoted. That path is now
covered by a test instead of being assumed.

The error messages changed too. `Unsupported ONNX opset version: 22. Supported range is
opset 7–21.` named a range without saying what to do about it; the ceiling and the floor
now have separate messages that tell the user to re-export.

This is only correct because `onnx` is pinned. An unpinned floor would move this ceiling
between deploys with no commit behind it — the measurement in
[014](./014-toolchain-versions-drift.md) found exactly that, with the venv reporting 26
and the image 27.

**Verified** in `build/test.Dockerfile` by `TestOpsetGate`: the ceiling equals
`onnx.defs.onnx_opset_version()` (a regression test against re-hardcoding it), an opset
22 model — refused outright before — is accepted, a model one above the ceiling is
refused with both numbers in the message, and a graph shape inference chokes on returns
metadata instead of raising. 32 tests pass under the 350m ceiling.

## Documentation corrected with it

`README.md` stated the range as a literal `7–21`. It now describes the ceiling as
tracking the pinned library, and says execution is the browser's limit.

The README's "known limitations" list was also pointing readers at
[001](./001-model-load-hang.md), [005](./005-input-tensor-dtype-mismatch.md) and
[010](./010-subgraph-nodes-never-surfaced.md) — all three closed. It now names the
limitations that are actually current: subgraph activations cannot be inspected, non-batch
dynamic axes are guessed, and `float16` / `string` inputs are refused.

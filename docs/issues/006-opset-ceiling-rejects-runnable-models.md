# Opset ceiling of 21 rejects models the client could run

- **Status:** Open
- **Severity:** Medium
- **Track:** Bug
- **Found:** 2026-08-22

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

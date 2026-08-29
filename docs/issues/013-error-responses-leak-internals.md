# Error responses return raw exception strings

- **Status:** Open
- **Severity:** Low
- **Track:** Chore
- **Found:** 2026-08-22

## Symptom

A failed request returns the original Python exception text to the client, which can
include absolute container paths and library-internal detail.

## Evidence

```python
# apps/backend/app/main.py:109
detail=f"Graph surgery failed: {str(e)}"
```

```python
# apps/backend/app/main.py:138
detail=f"An unexpected error occurred: {str(e)}"
```

Exceptions raised by `onnx.load` and by protobuf parsing routinely embed the path they
were given, which here is `/app/temp/<uuid>/extracted/<name>.onnx`.

## Impact

Limited. The leaked path contains no other user's data, and the UUID is single-use. What
it does expose is the container layout and the fact that uploads are staged on disk under
a predictable root — useful context for someone probing
[012](./012-upload-intake-is-unbounded.md) or
[007](./007-zip-extraction-has-no-size-limit.md).

Listed as Low because the direct exposure is small; it is worth closing before public
release simply because the fix is a few lines.

## Resolution criteria

1. Client-facing `detail` carries a stable, actionable message with no interpolated
   exception text.
2. The full exception, with traceback, is logged server-side.
3. Validation errors that the user *can* act on (bad ZIP, no `.onnx` inside, unsupported
   opset, unsupported dtype) keep their specific messages — this issue is about
   unexpected internal failures, not about making all errors vague.

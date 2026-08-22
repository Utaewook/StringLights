# Model inputs are built with TypedArrays that do not match their dtype

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [001](./001-model-load-hang.md)

## Symptom

Inference fails immediately for any model whose inputs are not `float32`, `int64`,
`uint8`, or `float64`. The failure surfaces as a generic `Inference failed: …` toast
from the worker, with no indication that the input dtype is the cause.

## Evidence

The main thread allocates the buffer from one switch and labels it with a different
value:

```ts
// apps/web-app/src/contexts/WorkerContext.tsx:185-189
case 'int32':
case 'int16':
case 'int8':
  data = new Int32Array(size);
  break;
```

```ts
// apps/web-app/src/contexts/WorkerContext.tsx:204
inputs[inp.name] = { data, shape, type: inp.dtype };
```

The worker then constructs the tensor from that pair verbatim:

```ts
// apps/web-app/src/ort-worker.ts:105
ortInputs[key] = new ort.Tensor(tensorType as ort.Tensor.Type, data, shape);
```

So an `int8` input becomes `new ort.Tensor('int8', Int32Array, shape)`. ONNX Runtime
enforces the dtype-to-TypedArray pairing and throws.

`bool`, `float16`, `uint16`, `uint32`, and `uint64` have no branch at all and fall
through to `default`, which allocates a `Float32Array` while still labelling the tensor
with the original dtype string.

## Suspected cause

The switch was written to cover buffer *allocation* (several dtypes share a convenient
JS array type) without accounting for the fact that `inp.dtype` is forwarded unchanged
as the ONNX Runtime tensor type. The two must agree.

A second contributor sits on the backend. The dtype table has no entry for `bfloat16`
(elem_type 16) or the float8 types, and unknown types are silently relabelled:

```python
# apps/backend/app/services/surgery.py:36
dtype = ELEM_TYPE_TO_STR.get(elem_type, "float32")
```

A model using one of those types is therefore reported to the frontend as `float32`,
which makes the resulting failure point at the wrong place.

## Impact

Whole classes of model cannot be run at all: transformer encoders with a `bool`
attention mask, fp16-quantised exports, and int8-quantised models. Because the error
text does not name the dtype, a user hitting this has no path to a workaround.

This may also be a contributing factor to [001](./001-model-load-hang.md) — both issues
were observed on the same load-then-run path and neither has a confirmed reproducer yet.

## Resolution criteria

1. Each dtype maps to the TypedArray ONNX Runtime requires for it, or the input is
   rejected before `session.run` with a message naming the unsupported dtype.
2. `ELEM_TYPE_TO_STR` either covers the remaining ONNX element types or reports unknown
   ones explicitly instead of defaulting to `float32`.
3. A dtype that the frontend cannot synthesise produces an actionable UI error rather
   than a runtime throw from inside the worker.

# Non-batch dynamic axes are guessed as 1

- **Status:** Open
- **Severity:** Medium
- **Track:** Bug
- **Found:** 2026-08-30
- **Related:** [005](./005-input-tensor-dtype-mismatch.md)

## Symptom

For a model with a dynamic axis that is not the batch axis — a sequence length,
a variable image side — the generated test input has that axis set to 1. The run
succeeds and the activations are real, but they describe a single-token or
single-pixel input rather than anything representative.

Nothing on screen says a dimension was guessed.

## Evidence

`apps/web-app/src/utils/modelInputs.ts`, `resolveShape`:

```ts
return input.shape.map((dim, axis) => {
  if (dim !== -1) return dim;
  return axis === 0 ? batchSize : 1;
});
```

This is already an improvement on what it replaced, which substituted the batch
size into *every* dynamic axis — a transformer at batch size 4 was given a
sequence length of 4 purely because the batch control happened to read 4. That
was wrong in a way this is not; both are guesses, but only one is silent about
being arbitrary.

## Suspected cause

Not a defect in the resolver so much as a gap in the product: the graph metadata
records that an axis is dynamic and nothing else. There is no way to infer a
sensible sequence length from the ONNX file, and no UI to ask for one.

## Impact

Bounded, and the least bad option available. A length of 1 is always shape-valid,
so the model runs. The cost is that the inspected activations may not represent
how the model behaves on real input, and the user has no way to tell that from
the screen.

## Resolution criteria

Either:

- **(a)** surface the resolved shape per input before the run, so a guessed axis
  is visible and the number is at least honest, or
- **(b)** let the user set the length of each dynamic axis, defaulting to 1.

(b) is the real fix and needs UI. (a) is cheap and removes the silence, which is
the part that actually misleads.

# Per-node standard deviation is always reported as 0

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-22

## Symptom

The node inspector always displays `Std = 0.0000` for every tensor, regardless of the
data. Min, max, mean, and the NaN/Inf flags are correct.

## Evidence

The worker computes stats but deliberately skips the standard deviation:

```ts
// apps/web-app/src/ort-worker.ts:41
std: 0, // Skipping std for performance
```

A correct implementation exists in `apps/web-app/src/utils/tensorStats.ts`
(`computeStats`), but it is unreachable:

```tsx
// apps/web-app/src/features/inspector/NodeInspector.tsx:67
const stats = inferenceStats[tensorKey] || computeStats(tensor);
```

`inferenceStats[tensorKey]` is the object produced by the worker. It is always truthy
after a successful run, so the `computeStats` fallback never executes.

## Impact

Directly contradicts the product's headline claim of per-node
`min / max / mean / std`. Shipping this while advertising standard deviation would be a
factual inaccuracy that reviewers can verify in seconds.

## Resolution criteria

Either:

- **(a)** compute the standard deviation in the worker (a second pass over the buffer,
  or Welford's algorithm in the existing single pass), or
- **(b)** stop displaying the field, and remove the claim from all user-facing copy.

Option (a) is preferred — the value is a primary reason to inspect activations. The
"performance" justification should be measured before it is accepted, since the same
loop already traverses every element.

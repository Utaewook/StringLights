# Per-node standard deviation is always reported as 0

- **Status:** Closed
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-22

## Symptom

The node inspector always displays `Std = 0.0000` for every tensor, regardless of the
data.

> **Correction (2026-09-19).** The sentence that stood here — "Min, max, mean, and the
> NaN/Inf flags are correct" — was wrong, and the issue is wider than its title. See
> [Wider than filed](#wider-than-filed) below. The title is kept so existing references
> stay valid.

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

## Wider than filed

Three defects, not one. The worker's loop flagged Inf and then fell through without
skipping it, and divided the sum by the buffer length after skipping NaN from that sum:

```ts
if (Number.isNaN(val)) { hasNaN = true; continue; }
if (!Number.isFinite(val)) { hasInf = true; }   // no continue
...
mean: len > 0 ? sum / len : 0                    // len, not the count used
```

Measured against the old implementation:

| input | old min | old max | old mean | correct |
| --- | --- | --- | --- | --- |
| `[2,4,4,4,5,5,7,9]` | 2 | 9 | 5 | std was 0, should be 2 |
| `[10,20,30,NaN]` | 10 | 30 | **15** | mean 20 |
| `[1,2,3,Inf]` | 1 | **Inf** | **Inf** | max 3, mean 2 |
| `[-Inf,5,7,9]` | **-Inf** | 9 | **-Inf** | min 5, mean 7 |
| `[-Inf,Inf,4,6]` | **-Inf** | **Inf** | **NaN** | min 4, max 6, mean 5 |

So an activation containing an outlier — the case the inspector exists to find — made
every number on the panel meaningless, not just the standard deviation.

## Resolution (2026-09-19)

Resolution criterion (a), by deletion rather than by writing anything new.

A correct implementation already sat in `apps/web-app/src/utils/tensorStats.ts`: it
excludes NaN and Inf from every numeric result, divides by the count actually used, and
computes std in a second pass. It was unreachable — `NodeInspector.tsx` reached it only
through `inferenceStats[tensorKey] || computeStats(tensor)`, and the store sets
`inferenceOutputs` and `inferenceStats` together (`modelStore.ts:32`), so the left side
is truthy whenever the right side would be evaluated. The fallback is kept for the
`stats || {}` path in `WorkerContext.tsx`, which can still leave stats empty.

The worker's duplicate is gone; `computeStats` now takes the buffer directly so both call
sites share one implementation. Two passes rather than Welford's: variance from a known
mean is the more stable of the two, and this runs in the worker where it costs the UI
thread nothing. The "performance" justification the original write-up asked to have
measured was never a real trade — the loop already traversed every element.

**Verified** by bundling `tensorStats.ts` with esbuild and exercising it under Node: 25
checks covering clean data, NaN, `+Inf`, `-Inf`, both infinities together, all-NaN, empty,
single-element and constant buffers, `BigInt64Array`, and a 1000-element cross-check of
std against an independently computed reference. The same inputs were run through the old
implementation to confirm each check fails without the fix.

This is not an automated test. The frontend still has no test runner, so nothing guards
the next change to this file — see [008](./008-ci-runs-no-tests.md).

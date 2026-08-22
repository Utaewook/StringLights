# Diagnostic `console.*` calls left in shipped code

- **Status:** Open
- **Severity:** Medium
- **Track:** Chore
- **Found:** 2026-08-22
- **Related:** [001](./001-model-load-hang.md)

## Symptom

13 `console.*` calls remain in `apps/web-app/src`. Most were added by commit `870c4ec`
to trace the model-load hang and were never removed.

## Evidence

```
$ grep -rn "console\." apps/web-app/src --include="*.ts" --include="*.tsx" | wc -l
13
```

Concentrated in `ort-worker.ts` (session creation tracing) and `WorkerContext.tsx`
(`"Main Thread: Posting LOAD message to worker..."` and similar).

## Impact

Noise in the production console, and it leaks internal step-by-step structure to anyone
who opens devtools. Low functional risk, but it reads as unfinished work on a project
that is about to be shown publicly.

## Resolution criteria

- Remove the tracing added for [001](./001-model-load-hang.md) **after** that issue is
  resolved — the logs are still the primary diagnostic while it is open.
- Keep genuine error reporting (`console.error` on a caught failure) or route it through
  a real logging path.
- Consider a lint rule so this cannot silently recur.

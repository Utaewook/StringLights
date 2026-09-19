# Diagnostic `console.*` calls left in shipped code

- **Status:** Closed
- **Severity:** Medium
- **Track:** Chore
- **Found:** 2026-08-22
- **Related:** [001](./001-model-load-hang.md)

## Symptom

13 `console.*` calls remain in `apps/web-app/src`. Most were added by commit `870c4ec`
to trace the model-load hang and were never removed.

> **Stale as of 2026-09-19.** The count was 10 by the time this was fixed, all of them
> in `ort-worker.ts` — the `WorkerContext.tsx` calls went during the
> [009](./009-worker-failures-bypass-error-channel.md) work without this file being
> updated. Kept as written; the measured state is under [Resolution](#resolution-2026-09-19).

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

## The dependency was circular

This file said to remove the tracing **after** 001 is resolved.
[001](./001-model-load-hang.md)'s criterion 4 said its own resolution requires the
logging to be gone, tracked here. Each waited on the other, so neither could close.

What actually justified keeping the logs is recorded in
[009](./009-worker-failures-bypass-error-channel.md): *"the only diagnostic available is
the `console.*` tracing tracked in 003 — which is why that tracing is still in the
tree."* Closing 009 removed that justification — `onerror` and `onmessageerror` now put
real error text on screen — and neither write-up noticed.

It is moot in the other direction too. 001's one remaining criterion is to reproduce the
hang against the model that first showed it, and that model has not been found. Tracing
in the worker cannot help find a file.

## Resolution (2026-09-19)

Six `console.log` calls removed from `ort-worker.ts` — the session-creation trace
(`"received LOAD request"`, `"attempting WebGPU session creation..."`, and the rest).

Four calls kept, which is what this issue's second criterion asks for:

| line | call | why it stays |
| --- | --- | --- |
| `console.error` | session load failed | carries the `Error` object; the UI gets only `err.message`, without the stack |
| `console.error` | inference run failed | same |
| `console.warn` | WebGPU fell back to WASM | carries the *reason*; the UI badge says only that it fell back |
| `console.warn` | unknown worker message type | the `default` branch added for [009](./009-worker-failures-bypass-error-channel.md)'s criterion 3 |

Third criterion met as well. `eslint.config.js` gains:

```js
'no-console': ['error', { allow: ['warn', 'error'] }],
```

`test-and-lint` runs ESLint and both `build-and-push` and `deploy` gate on it, so this
now fails a build rather than relying on someone noticing. Verified by appending a
`console.log` and confirming ESLint rejects it:

```
114:1  error  Unexpected console statement. Only these console methods are allowed:
              warn, error  no-console
```

The `allow` list is not a loophole left open — it is the four calls above, and anything
new that is genuinely an error report is the same kind of thing.

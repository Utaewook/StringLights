# Worker failures outside the message channel are invisible to the UI

- **Status:** Closed
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [001](./001-model-load-hang.md)

## Symptom

Any worker failure that does not arrive as a `postMessage` leaves the UI stuck in its
loading state forever, with no error and no way to recover short of a page reload.

## Evidence

`apps/web-app/src/contexts/WorkerContext.tsx` registers exactly one worker event handler:

```
39:  workerRef.current = new Worker(...)
44:  workerRef.current.onmessage = (e: MessageEvent) => { ... }
78:  workerRef.current?.terminate();
```

There is no `onerror` and no `onmessageerror`. The `case 'ERROR'` branch
(`WorkerContext.tsx:63-67`) is correctly implemented and does clear
`setModelLoading(false)` — but it only runs when the worker is alive enough to send a
message.

There is also no timeout anywhere on the load path:

```
$ grep -n "timeout\|setTimeout" apps/web-app/src/contexts/WorkerContext.tsx
(no matches)
```

## Suspected cause

The error path was designed entirely around the worker's own `try/catch`
(`apps/web-app/src/ort-worker.ts:55-85`), which posts `{ type: 'ERROR' }` on a caught
exception. That covers rejected promises inside the handler. It does not cover:

- the browser terminating the worker under memory pressure,
- a synchronous throw outside the promise chain,
- a structured-clone failure when posting results back,
- the WASM runtime trapping without unwinding to JS.

In each of those cases nothing is posted, so nothing is handled.

## Impact

This is the mechanism that turns *any* unhandled failure into issue
[001](./001-model-load-hang.md)'s indefinite hang. The two are commonly reported as one
problem, but they are separable: 001 is about *why* a specific model fails, this issue is
about *why the failure is unobservable*.

Consequently 001 cannot be diagnosed from the field. There is no error text to collect,
so the only diagnostic available is the `console.*` tracing tracked in
[003](./003-diagnostic-console-logs.md) — which is why that tracing is still in the tree.

## Resolution criteria

1. `onerror` and `onmessageerror` are registered on the worker and route into the same
   UI error path as `case 'ERROR'`.
2. Load and run each have a timeout that resolves the UI into an actionable error state
   rather than leaving it loading.
3. The `switch` in `onmessage` has a `default` branch, so an unrecognised message type is
   surfaced rather than silently dropped.
4. Fixing this is a prerequisite for closing [001](./001-model-load-hang.md): once a
   failure produces text, that text is the evidence 001's resolution criteria require.

## Resolution

`WorkerContext.tsx` now registers `onerror` and `onmessageerror` alongside
`onmessage`, both routed through one helper that clears `isModelLoading` and
`isInferenceRunning` and puts a message on screen. `onerror` calls
`preventDefault()` so the same failure is not additionally reported as an
uncaught console error, which reads like a second, unrelated problem.

Two more paths into the same stuck state are closed with it. A missing worker
was logged and then ignored; it now raises into the existing catch. And the
surgery request had no deadline at all — with surgery serialised behind
`Semaphore(1)`, a queued request could hang the UI indefinitely. It now aborts
at 150s, above the backend's own 90s bound and nginx's 120s, so the server's
explanation wins whenever there is one.

Verified by ESLint and `tsc -b` in the frontend builder image. The failure modes
themselves are not covered by an automated test, because the frontend still has
no test runner — see [008](./008-ci-runs-no-tests.md).

# The uploaded model is kept in the store and never read

- **Status:** Open
- **Severity:** Low
- **Track:** Chore
- **Found:** 2026-10-17
- **Related:** [018](./018-inference-memory-is-unbounded.md)

## Symptom

No symptom has been observed. Every uploaded model is held in memory for the life
of the session by state that nothing consumes.

## Evidence

`modelStore` declares it, initialises it, sets it, and clears it on reset:

```ts
// apps/web-app/src/store/modelStore.ts
loadedModelBytes: Uint8Array | null;
setLoadedModelBytes: (bytes) => set({ loadedModelBytes: bytes }),
```

One caller writes it:

```ts
// apps/web-app/src/contexts/WorkerContext.tsx:207
model.setLoadedModelBytes(modelBytes);
```

Nothing reads it:

```
$ grep -rn "loadedModelBytes" apps/web-app/src --include="*.ts" --include="*.tsx" \
    | grep -v modelStore.ts
(no matches)
```

The same `Uint8Array` is also posted to the worker, which is the only consumer that
exists. The store's reference keeps it alive after the worker has its own copy.

## Impact

Bounded and small, which is why this is Low: at most 50MB, the upload ceiling, held
until the next upload replaces it or the tab closes. It is wasted rather than
dangerous.

It is worth recording because it was found while bounding memory for
[018](./018-inference-memory-is-unbounded.md) and sits in the same family: the model
bytes are a term nobody accounts for, in a tool whose failure mode is the tab being
killed.

## Suspected cause

Most likely written for a re-load path — reloading the current model without a round
trip to the server — that was never built. The setter and the reset branch are both
present and correct; only the reader is missing.

## Resolution criteria

Either:

- **(a)** remove `loadedModelBytes`, its setter, and its reset branch, or
- **(b)** use it, if a re-load path is wanted, and say in the store what reads it.

(a) unless a re-load feature is actually planned. Removing state is cheap and the
`grep` above is the whole audit.

Note that [018](./018-inference-memory-is-unbounded.md) deliberately does **not**
transfer this buffer to the worker for exactly this reason: while the store holds a
reference, detaching it would corrupt that reference silently. If (a) is taken, the
`LOAD` message can transfer too, and the comment in `WorkerContext.tsx` saying why it
does not should go with it.

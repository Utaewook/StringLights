# Graph surgery blocks the event loop and has no time bound

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [007](./007-zip-extraction-has-no-size-limit.md)

## Symptom

While one surgery request is being processed, the backend answers nothing at all — not
other surgery requests, and not unrelated endpoints such as `/api/health`. A sufficiently
slow model keeps it that way indefinitely.

## Evidence

The service runs a single worker:

```dockerfile
# build/backend.Dockerfile:18
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

`perform_surgery` is declared `async def`, but every expensive call inside it is a
synchronous, CPU- or IO-bound function invoked directly on the event loop, with no
`run_in_threadpool` / `run_in_executor` offload:

```python
# apps/backend/app/main.py:64   shutil.copyfileobj(file.file, buffer)
# apps/backend/app/main.py:69   zip_ref.extractall(extract_dir)
```

```python
# apps/backend/app/services/surgery.py  (via run_graph_surgery)
onnx.load(...)  /  onnx.shape_inference.infer_shapes(...)  /  onnx.save(...)
```

An `async def` coroutine that never awaits between blocking calls holds the loop for its
entire duration. With one worker there is no second loop to answer anything else.

There is also no time bound on the work. `run_graph_surgery` is called without
`asyncio.wait_for` (`main.py:96-100`). The only timeout in the stack is on the proxy:

```nginx
# build/nginx/nginx.conf:76
proxy_read_timeout 120s;
```

That governs the nginx-to-backend socket. It disconnects the client after 120s; it does
not cancel the backend computation, which keeps running — and, because the code is
synchronous, cannot observe the disconnect either.

## Suspected cause

`Semaphore(1)` was introduced to serialise graph surgery for memory reasons, and it does
that correctly. The reasoning appears to have stopped there: serialising the work was
treated as equivalent to bounding it. Serialisation limits *concurrency*, not *duration*,
and says nothing about whether the serialised work yields the loop.

## Impact

A single request monopolises the entire service for as long as it takes. Combined with the
absence of a computation timeout, one pathological graph — or one request exploiting
[007](./007-zip-extraction-has-no-size-limit.md) — takes the site down for everyone until
the process is restarted. No authentication is required to send one.

Health checks failing during normal operation also makes the service indistinguishable
from a crashed one to any external monitor.

## Resolution criteria

1. Blocking work runs off the event loop (`run_in_threadpool` or an explicit executor), so
   that unrelated endpoints stay responsive while surgery is in progress.
2. Surgery has an explicit wall-clock bound, and exceeding it returns an error and
   releases the semaphore rather than running forever.
3. `/api/health` is verified to answer while a surgery request is in flight.

## Resolution

`apps/backend/app/services/isolation.py` runs surgery in a throwaway child
process. The event loop only waits on a pipe, so `/api/health` and every other
endpoint stay responsive while a model is being processed.

The time bound is `SURGERY_TIMEOUT_SECONDS = 90` in `main.py`, kept under
nginx's `proxy_read_timeout` of 120s so a slow model returns this service's 504
rather than nginx's generic gateway error.

A thread was considered and rejected. It would have freed the event loop and
nothing else: Python threads cannot be interrupted, so a timed-out surgery would
have kept both its CPU and its memory and the timeout would have been
decoration. A child process can be killed, and its exit returns every byte
`onnx` allocated to the OS.

`spawn` rather than `fork`: uvicorn is multi-threaded, and forking a process
holding locks in other threads can deadlock the child. The cost is that the
child re-imports `onnx`, which is wanted anyway — `onnx` is imported inside the
worker, so the parent never carries its resident footprint.

Verified directly against the module: a child that would run for 60s is stopped
at the 2.0s timeout, and a child that dies without sending a result is reported
as a failure rather than hanging.

**Remaining:** the end-to-end path has not been exercised against a running
backend — see [008](./008-ci-runs-no-tests.md).

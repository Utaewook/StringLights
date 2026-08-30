# Upload intake is unbounded before the size and concurrency limits apply

- **Status:** Open
- **Severity:** Medium
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [007](./007-zip-extraction-has-no-size-limit.md), [011](./011-surgery-blocks-the-event-loop.md)

## Symptom

No symptom has been observed. Both defences the project relies on — the 50MB cap and
`Semaphore(1)` — are applied only after the request body has already been received in
full, so neither constrains how much unauthenticated traffic the host absorbs.

## Evidence

Ordering inside the handler:

```python
# apps/backend/app/main.py
14:  surgery_semaphore = asyncio.Semaphore(1)
...
33:  file.file.seek(0, os.SEEK_END)     # size check starts here
37:  if file_size > MAX_FILE_SIZE:
...
60:  async with surgery_semaphore:      # concurrency gate is later still
```

`file: UploadFile = File(...)` is a dependency. FastAPI resolves it — meaning
python-multipart consumes and spools the entire body — *before* the function body runs.
By the time line 33 measures the file, the bytes are already on the host. By the time
line 60 acquires the semaphore, they have been there for a while.

The only per-request bound is at the proxy:

```nginx
# build/nginx/nginx.conf:54   client_max_body_size 55M;
# build/nginx/nginx.conf:7    worker_connections 1024;
```

`client_max_body_size` bounds one request. Nothing bounds how many arrive at once — there
is no `limit_req` or `limit_conn` in the nginx config, and no rate limiting in the
application.

## Suspected cause

The 50MB check is written as "early validation of file size" (the comment at
`main.py:32`), and reads that way. But "early" is relative to the handler, not to the
request: in the ASGI lifecycle, dependency resolution has already completed. The check
protects the *processing* path, which was the intent, and was mistaken for protecting the
*intake* path.

## Impact

The backend container is capped at 350MB (`build/docker-compose.yml:14`), not the 512MB
the documentation cites. Concurrent uploads near the 55MB proxy ceiling can pressure that
budget before any application-level defence has a chance to run. A cgroup OOM kill is a
`SIGKILL`: no graceful shutdown, no cleanup of the in-flight request's temp directory, and
the semaphore dies with the process.

This compounds [011](./011-surgery-blocks-the-event-loop.md): intake is unbounded, and the
processing that follows is unbounded in time.

## Resolution criteria

1. Request bodies are bounded before they are fully buffered — a streaming read that
   aborts past the limit, or an equivalent ASGI-level guard.
2. Concurrent request count is bounded at the proxy (`limit_conn` / `limit_req`), sized
   against the 350MB container limit rather than the 512MB host figure.
3. The documented memory budget states the container limit (350MB), not the host's
   512MB. This is the same "documented contract does not match enforced behaviour"
   drift recorded in [007](./007-zip-extraction-has-no-size-limit.md).

## Correction (2026-08-30)

Severity lowered from High to Medium. The original write-up did not account for
the deployed topology.

nginx sets `client_max_body_size 55M` and answers `413` before proxying, and the
backend uses `expose`, not `ports` — port 8000 exists only on the compose
network and is not reachable from the host. An arbitrarily large body therefore
cannot reach the backend at all in production; the worst case is a 55MB spool,
bounded and cheap.

What remains true is that Starlette receives the whole body before the handler's
50MB check runs, so a 55MB upload is written to disk before being rejected. That
is wasteful, not dangerous, and it is invisible to anything but the disk.

The related decompression risk is a separate matter and is resolved in
[007](./007-zip-extraction-has-no-size-limit.md).

# ZIP extraction has no decompressed-size limit

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [011](./011-surgery-blocks-the-event-loop.md), [012](./012-upload-intake-is-unbounded.md)

## Symptom

No symptom has been observed. This is a latent failure mode on the 512MB host, reachable
by any unauthenticated request.

## Evidence

The upload is size-checked before extraction, and never after:

```python
# apps/backend/app/main.py:37
if file_size > MAX_FILE_SIZE:   # 50MB, measured on the compressed archive
```

```python
# apps/backend/app/main.py:68-69
with zipfile.ZipFile(zip_path, "r") as zip_ref:
    zip_ref.extractall(extract_dir)
```

`extractall` writes every member to disk with no cap on the total written, no cap on
member count, and no check of the declared uncompressed size in the ZIP central
directory. A 50MB archive of compressible data expands by orders of magnitude.

Path traversal is **not** part of this issue — CPython's `ZipFile._extract_member`
strips drive letters, leading separators, and `..` components, so a Zip Slip payload
cannot escape `extract_dir`. Symlink members are extracted as regular files rather than
followed. The exposure here is resource exhaustion only.

## Suspected cause

The 50MB limit is documented throughout the project as *the* upload defence
(`../guide/01_project_overview.md` §2, `../guide/03_architecture.md` §1, `CLAUDE.md` §2).
It is stated in terms of the uploaded file, and the ZIP wrapper was introduced later —
so the limit silently changed meaning from "bytes the server will handle" to "bytes the
server will receive".

## Impact

The backend container is limited to **350MB** (`build/docker-compose.yml:14`), not the
512MB the rest of the documentation cites — the host's 512MB is shared with the frontend
container (50MB) and the OS. Extraction happens inside the `Semaphore(1)` critical section
(`main.py:60`), so a single request that fills the disk blocks every queued request behind
it, and cleanup for the offending request only runs after the failure propagates.

The 50MB cap that the documentation presents as the OOM defence does not constrain this
path at all.

## Resolution criteria

1. Extraction enforces a total uncompressed-byte budget and a member-count budget,
   aborting with `400 Bad Request` when either is exceeded.
2. The budget is derived from the documented 50MB contract, not from a second unexplained
   constant.
3. The docs that describe the 50MB limit state which quantity it bounds, so the
   compressed/uncompressed distinction is not lost again.

## Severity raised to High, 2026-08-22

Originally filed as Medium on the reasoning that no symptom had been observed. Raised
after two adjacent findings were confirmed:

- [012](./012-upload-intake-is-unbounded.md) — the 50MB check and `Semaphore(1)` both run
  *after* the body is fully received, so neither bounds intake.
- [011](./011-surgery-blocks-the-event-loop.md) — the extraction and surgery calls are
  synchronous on a single-worker event loop, so one request stalls every endpoint.

Together these make an unauthenticated request able to take the service down, which meets
this project's `Critical`/`High` bar ("breaks the core flow") rather than the `Medium` one
("no direct user impact"). The three are kept as separate files because they have separate
fixes; this one remains scoped to the decompression budget.

## Design notes for the fix

1. **Do not trust `ZipInfo.file_size`.** It is a value the archive's author wrote. CPython
   verifies CRC only *after* a member has been fully decompressed, so a declared size can
   understate reality by orders of magnitude and `extractall` offers no hook to intervene.
   Read members through `ZipFile.open()` in fixed-size chunks and compare a running count
   of *actual* bytes against the budget, aborting mid-stream. The declared size is useful
   only as a cheap first-pass filter.
2. **Reuse the 50MB constant rather than introducing a second one.** Resolution criterion
   2 asks the budget to derive from the documented contract; re-applying the existing
   number to the uncompressed total is the reading that satisfies it.
3. **The member-count cap derives from the data model, not from the byte budget.** The
   handler consumes exactly one `.onnx` plus an optional companion data file
   (`main.py:76-87`, `surgery.py:75-83`), so a small fixed cap is justified on its own
   terms and closes the many-tiny-files variant that a byte budget alone does not.
4. **Cleanup already works.** Aborting with an exception lands in the existing
   `except Exception` handler (`main.py:132-133`), which calls `cleanup_directory` inside
   the semaphore. No new cleanup path is needed.

## Resolution

`apps/backend/app/services/archive.py` replaces `ZipFile.extractall` with a
bounded extractor. Limits are 150MB across the archive and 80MB for the model
itself, chosen against the container's 350M ceiling and surgery's ~2x peak.

Enforced twice: against the headers, which rejects a bomb before a byte is
written, and against bytes actually written. The measured pass is defence in
depth — CPython's `zipfile` truncates each member read at its declared
`file_size`, so an understated header surfaces as a CRC failure first. That is a
standard-library detail, not a property of the format, and the limits should not
rest on it.

Writing members by hand also loses the path sanitising `extractall` performs, so
`_safe_destination` rejects any member resolving outside the destination.

Verified directly against the module: a 199KB archive expanding to 200MB is
refused with nothing written to disk, a `../../` member is refused with nothing
created outside the destination, and ordinary flat and nested archives extract
byte-for-byte.

**Remaining:** the end-to-end path has not been exercised against a running
backend. The dependencies are not installed locally and CI runs no backend tests
— see [008](./008-ci-runs-no-tests.md).

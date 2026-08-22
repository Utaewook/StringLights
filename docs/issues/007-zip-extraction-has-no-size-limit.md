# ZIP extraction has no decompressed-size limit

- **Status:** Open
- **Severity:** Medium
- **Track:** Bug
- **Found:** 2026-08-22

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

The host has 20GB of storage and 512MB of RAM with swap. Extraction happens inside the
`Semaphore(1)` critical section (`main.py:60`), so a single request that fills the disk
blocks every queued request behind it, and cleanup for the offending request only runs
after the failure propagates.

The 50MB cap that the documentation presents as the OOM defence does not constrain this
path at all.

## Resolution criteria

1. Extraction enforces a total uncompressed-byte budget and a member-count budget,
   aborting with `400 Bad Request` when either is exceeded.
2. The budget is derived from the documented 50MB contract, not from a second unexplained
   constant.
3. The docs that describe the 50MB limit state which quantity it bounds, so the
   compressed/uncompressed distinction is not lost again.

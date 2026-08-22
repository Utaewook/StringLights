# `.gitignore` no longer matches the backend temp directory

- **Status:** Open
- **Severity:** Medium
- **Track:** Chore
- **Found:** 2026-08-22

## Symptom

`.gitignore` excludes `temp_in_*` and `temp_out_*`, but the backend no longer uses those
names. Uploaded models and surgery output are written to a per-request UUID directory
that is **not ignored**.

## Evidence

`.gitignore`:

```
# Temporary Surgery & Model Files
temp_in_*
temp_out_*
```

`apps/backend/app/main.py:17,51-53` — the actual location:

```python
TEMP_ROOT = os.path.join(..., "temp")
session_id = str(uuid.uuid4())
temp_dir   = os.path.join(TEMP_ROOT, session_id)
```

The directory `apps/backend/temp/` exists in the working tree and is currently empty, so
nothing has been committed by accident yet. The `*.onnx` rule provides partial cover,
but the ZIP inputs and outputs are not covered.

## Impact

If a request dies before its cleanup runs — a hard crash, or the process being killed
mid-surgery on the 512MB host — leftover user model archives can be staged by a careless
`git add`. On a repository heading for public release, that is an avoidable data leak.

## Resolution criteria

1. Ignore `apps/backend/temp/` explicitly.
2. Drop the obsolete `temp_in_*` / `temp_out_*` rules, or keep them only if some path
   still produces those names.
3. Reconcile the stale reference in `CLAUDE.md` §4, which still tells the reader to check
   for `temp_in_*` / `temp_out_*` when cleaning the workspace.

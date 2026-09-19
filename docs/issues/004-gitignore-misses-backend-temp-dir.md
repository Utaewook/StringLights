# `.gitignore` no longer matches the backend temp directory

- **Status:** Closed
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

## Wider than filed: `.onnx.data` was never covered

The write-up noted that "the ZIP inputs and outputs are not covered" and credited
`*.onnx` with partial cover. The gap is larger than that — **`*.onnx` does not match
`*.onnx.data`**, and external data files are where the weights actually are. A model
`.onnx` with external data is a few KB of graph; the `.onnx.data` beside it is the
entire set of trained parameters.

Demonstrated accidentally on 2026-09-19 while staging a model to verify
[001](./001-model-load-hang.md) in the browser:

```
$ git status --short
?? .fixture-tmp/          # contained ae_model.onnx.data, 133KB of weights
```

The `.onnx` in the same directory was ignored. The weights were not.

## Resolution (2026-09-19)

```gitignore
apps/backend/temp/
*.onnx
*.onnx.data
*.wasm
```

`temp_in_*` and `temp_out_*` are gone. Nothing in the tree produces those names —
confirmed by grep across `.py`, `.ts`, `.tsx`, `.yml` and the Dockerfiles — so they were
protecting nothing, which is criterion 2's first branch rather than its second.

Ignoring the directory rather than a filename pattern is the point. `main.py` stages
`input.zip`, `extracted/` and `output.zip` under `apps/backend/temp/<uuid>/`, and a rule
tied to the directory the code reads from cannot drift out of step with it the way a name
pattern did. The backend creates the root itself (`os.makedirs(..., exist_ok=True)` on
the per-request path creates its parents), so ignoring it entirely is safe.

`CLAUDE.md` §4 now tells the reader to check that `apps/backend/temp/` is empty.

**Verified** with `git check-ignore` on all four paths a real request produces — the
staged zip, the extracted `.onnx`, its `.onnx.data`, and an `.onnx.data` dropped
elsewhere in the tree. All four are ignored; none was before.

# Toolchain versions drift between local, Docker, and CI

- **Status:** Open
- **Severity:** Medium
- **Track:** Chore
- **Found:** 2026-08-22
- **Related:** [008](./008-ci-runs-no-tests.md), [006](./006-opset-ceiling-rejects-runnable-models.md)

## Symptom

The Python interpreter and the `onnx` version used during local development are not the
ones production runs, and nothing pins either to a specific version.

## Evidence

Interpreter:

```
build/backend.Dockerfile:1   FROM python:3.12-slim
apps/backend/venv           Python 3.14.2   (measured)
```

There is no Python 3.12 on the development machine, so the local environment cannot
currently match the image even if asked to.

Dependencies:

```
# apps/backend/requirements.txt
onnx>=1.14.0        # unpinned lower bound
fastapi>=0.100.0
uvicorn>=0.22.0
python-multipart>=0.0.6
httpx>=0.24.0
```

Every dependency is an unpinned lower bound, so each image rebuild can resolve to
different versions than the last. Locally this has already resolved to `onnx 1.21.0`.

This interacts with [006](./006-opset-ceiling-rejects-runnable-models.md): the hard-coded
`SUPPORTED_OPSET_RANGE = (7, 21)` was presumably chosen against some `onnx` version, but
since no version is pinned there is no version it is guaranteed to correspond to. The
installed `onnx 1.21.0` reports `onnx.defs.onnx_opset_version() == 26`.

Test tooling is absent entirely — `pytest` is not in `requirements.txt`, despite six tests
existing under `apps/backend/tests/`.

## Impact

"Works locally" carries no information about the image. A dependency resolution change
between two builds can alter graph-surgery behaviour with no corresponding commit, and the
opset gate can silently diverge from the library enforcing it.

For a project whose core operation is version-sensitive ONNX graph manipulation, an
unpinned `onnx` is the dependency least suited to floating.

## Resolution criteria

1. Runtime dependencies are pinned to exact versions, with a documented update path.
2. Test dependencies live in their own file (`requirements-dev.txt`) so the production
   image does not carry them.
3. CI uses the interpreter version the image uses, and that version is stated in one place
   both can be checked against.
4. Local development either matches the image version or the mismatch is documented as
   accepted, with a note on what it does not prove.

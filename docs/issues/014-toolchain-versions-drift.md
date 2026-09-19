# Toolchain versions drift between local, Docker, and CI

- **Status:** Closed
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

## Also drifting: the workflow's own actions (2026-08-30)

Run 33303853559 annotated:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are being
> forced to run on Node.js 24: `actions/checkout@v4`, `actions/setup-node@v4`.

Nothing is broken — the runner substitutes a newer Node — but the workflow is no
longer running what it declares, which is the same class of problem as the
unpinned `requirements.txt` entries above. `@v5` of both actions removes it.

## Update (2026-09-14)

The annotation has widened. Run 34827167800, the first `main` deploy since
2026-08-29, flagged the Docker actions in `build-and-push` as well:

| Job | Actions declaring Node 20 |
| --- | --- |
| `test-and-lint` | `actions/checkout@v4`, `actions/setup-node@v4` |
| `build-and-push` | `actions/checkout@v4`, `docker/login-action@v3`, `docker/setup-buildx-action@v3`, `docker/build-push-action@v5` |
| `deploy` | `actions/checkout@v4` |

Bumping only `checkout` and `setup-node`, as suggested above, would leave the
image build running on a runtime it does not declare. Each Docker action needs a
release that declares Node 24, checked against its own changelog rather than
assumed from the major version.


## Measured before fixing (2026-09-19)

The drift was not hypothetical. The same `requirements.txt` resolved differently in
the two places it is installed:

| | Python | `onnx` | `onnx.defs.onnx_opset_version()` |
| --- | --- | --- | --- |
| `apps/backend/venv` | 3.14.2 | 1.21.0 | 26 |
| production base image | 3.12.14 | 1.22.0 | **27** |

And the base image tag moved *during this session*: `python:3.12-slim` resolved to
`sha256:6c4dd321…` when pulled and `sha256:2f17fc04…` when queried an hour later.

This compounds with the pipeline. Neither `docker/build-push-action` step sets
`cache-from` or `cache-to`, and each run gets a fresh `ubuntu-latest` runner, so there
is **no layer cache between deploys** — every push to `main` re-resolves `onnx>=1.14.0`
from PyPI. The library that rewrites users' graphs could change version with no commit
behind it, and nothing recorded which one shipped.

[016](./016-deploys-cannot-be-rolled-back.md) anticipated this: rolling back works
because GHCR holds the built image, but *rebuilding* the last good commit was never
guaranteed to reproduce it.

## Resolution (2026-09-19)

**Criterion 1 — runtime dependencies pinned.** `requirements.txt` holds exact versions
with the update path in its header: bump a pin, rebuild `build/test.Dockerfile`, run the
suite, commit the version with the result, and never widen a pin to make a build pass.

These are direct dependencies only, and the file says so. Transitive versions still float
within the ranges those packages declare — the suite picked up a new `anyio` deprecation
warning on the rebuild, which is that limitation behaving exactly as described. A real
lockfile is the further step and is not taken here.

**Base images pinned by digest** — not in the criteria, but the same defect:

```
python:3.12-slim@sha256:2f17fc04…   (backend.Dockerfile, test.Dockerfile)
node:20-alpine@sha256:fb4cd12c…     (frontend.Dockerfile builder)
nginx:alpine@sha256:62ff2089…       (frontend.Dockerfile runtime)
```

Each digest was checked against the registry to confirm it names a multi-arch index
containing `linux/amd64` before being pinned. A digest naming a single-architecture
image would build here and fail on the runner.

**Criterion 2** was already met — `requirements-dev.txt` exists and the production image
carries no test runner.

**Criterion 3 — CI uses the image's interpreter.** The backend suite runs *inside*
`build/test.Dockerfile`, so it cannot use anything else. `setup-node` pins Node 20,
matching `node:20-alpine`.

**Criterion 4 — the local mismatch is documented as accepted.** `docs/guide/04_convention.md`
Rule 7 now states what `apps/backend/venv` does and does not prove: it runs Python 3.14
against some `onnx`, so a green run there says the logic holds on *some* version, not on
the one that ships.

**Verified** by rebuilding both images from the pinned bases. The backend image resolves
exactly the pinned versions on Python 3.12.14 and the suite passes 28/28 under the 350m
ceiling; the frontend image builds and serves its assets under nginx 1.31.6.

## Remaining: the workflow's own actions

`actions/checkout` and `actions/setup-node` are bumped to `@v5`, which is what this file
asked for. The Node 20 deprecation notice also names `docker/build-push-action@v5`,
`docker/login-action@v3` and `docker/setup-buildx-action@v3`. Those are left alone
deliberately: they are a different vendor's versioning, the notice is a warning rather
than a break, and bumping four actions at once on the pipeline that deploys to production
is not a change to make alongside a dependency pin. Filed here rather than in a new issue
because it is the same drift.

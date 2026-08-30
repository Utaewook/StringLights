# CI runs no tests

- **Status:** Open
- **Severity:** Medium
- **Track:** Chore
- **Found:** 2026-08-22
- **Related:** [014](./014-toolchain-versions-drift.md)

## Symptom

A push to `main` reaches production having passed lint and nothing else. The backend
test suite exists but is never executed automatically, and the frontend has no test
framework installed.

## Evidence

The job named `test-and-lint` only lints:

```yaml
# .github/workflows/deploy.yml:19-34
  test-and-lint:
    runs-on: ubuntu-latest
    steps:
      ...
      - name: Install Frontend Dependencies & Lint
        working-directory: apps/web-app
        run: |
          npm ci
          npm run lint
```

There is no Python setup step, no `pip install -r requirements.txt`, and no `pytest`
invocation anywhere in the workflow. Six backend tests exist and are unreferenced:

```
apps/backend/tests/test_api.py     — 5 tests
apps/backend/tests/test_surgery.py — 1 test
```

`apps/web-app/package.json` declares no test runner (`vitest`, `jest`, or otherwise) and
no `test` script. `build-and-push` and `deploy` both gate on `needs: test-and-lint`, so
the only thing standing between a commit and the Lightsail host is ESLint.

## Impact

The three defects found so far on the inference path — [001](./001-model-load-hang.md),
[002](./002-tensor-std-always-zero.md), and [005](./005-input-tensor-dtype-mismatch.md) —
share a shape: each is mechanical, each is reachable from a small unit test, and each was
found by reading the code after it shipped rather than by running it. Untested paths
carrying real logic include `run_graph_surgery`'s external-data branch, the opset gate,
and `computeStats`.

Deploying straight to a 512MB single-host production environment on a green lint run
means a regression in graph surgery is discovered by a user, not by the pipeline.

## Resolution criteria

1. `pytest` runs in CI against `apps/backend`, and a failure blocks `build-and-push`.
2. The frontend has a test runner and at least the pure logic under `src/utils/` and
   `src/store/` is covered.
3. Coverage is reported so the 80% target in the workspace rules becomes measurable
   rather than aspirational.

## Confirmed while planning the fix, 2026-08-22

**The existing tests are ready to use.** All six were executed locally and pass in 0.26s.
They build their ONNX fixtures in memory with `onnx.helper`, so there are no committed
`.onnx` files to manage and no environment dependencies. Wiring them into CI is purely a
workflow change.

**`pytest` is not declared anywhere.** It is absent from `requirements.txt`, so the tests
run today only because a developer installed it by hand. Tracked in
[014](./014-toolchain-versions-drift.md).

**CI must run pytest from the right directory.** Neither `apps/backend/tests/` nor
`apps/backend/app/` has an `__init__.py`, and there is no `pytest.ini` / `pyproject.toml`
setting `pythonpath`. Under pytest's default `prepend` import mode, only `tests/` lands on
`sys.path`, so `from app.main import app` fails with `ModuleNotFoundError`. The invocation
must be `python -m pytest` with `apps/backend` as the working directory — `python -m` is
what puts the current directory on `sys.path`. A bare `pytest` will not work.

**Type checking does not run on `develop` either.** The workflow triggers on both `main`
and `develop` (`deploy.yml:3-11`), but `tsc -b` only executes inside
`build/frontend.Dockerfile:10`, which is reached from `build-and-push` — and that job is
gated to `main`. So a TypeScript type error passes CI on `develop` and is first caught at
the Docker build on merge. Adding `npm run build` to `test-and-lint` closes this; the
script already chains `copy-wasm` before `tsc -b`, so no separate step is needed.

## Update (2026-08-30)

The missing half of this issue was never the tests — it was somewhere to run
them. `build/test.Dockerfile` now builds the backend suite against the
production base image, and the suite has grown from 6 tests to 17.

CI still does not invoke it. The `test-and-lint` job installs Node and runs
ESLint; it sets up no Python and runs no backend test. Closing this issue is now
a matter of adding a job that builds that image and runs it, which is the last
step rather than the whole problem.

## Progress (2026-08-30)

**Criterion 1 is met.** `test-and-lint` now builds `build/test.Dockerfile` and
runs the backend suite inside it, under the same 350m ceiling as production —
surgery spawns child processes and is bounded by container memory, so a run on
the bare runner would exercise neither. `build-and-push` and `deploy` both gate
on this job, so a backend regression now blocks the deploy.

The suite has grown from 6 tests to 23 while the surrounding work was done, and
`tsc -b` moved into this job as well. It previously ran only inside the frontend
image build, which is a `main`-only job, so a type error reached production
before anything checked for it.

**Criterion 2 is not met.** `apps/web-app` still declares no test runner, so the
pure logic in `src/utils/` — `computeStats`, `modelInputs`, `graphLayout` — has
no automated coverage. `modelInputs` was verified once by bundling it with
esbuild and running it under Node, which proves the logic and protects nothing:
the next change to it is unguarded.

Installing a runner is a dependency decision and needs sign-off, which is why it
is not done here. This issue stays Open until it is.

# CI runs no tests

- **Status:** Open
- **Severity:** Medium
- **Track:** Chore
- **Found:** 2026-08-22

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

# AI Coding Rules (Must Follow)

Obey these rules when you write code. The rules apply to developers and to AI assistants.

---

## 1. Backend (Python/FastAPI)

### Rule 1: No Inference Libraries on Backend
*   Do not use `import onnxruntime` anywhere in the backend codebase.
*   Only use `import onnx` to manipulate graphs (Graph Surgery) and execute Shape Inference.

### Rule 2: Strict Queueing via Semaphore(1)
*   To protect the backend container's **350M** memory limit (`build/docker-compose.yml`), apply `asyncio.Semaphore(1)` to the entry point of the Graph Surgery API endpoint to serialize concurrent operations. The host has 512MB, but it also runs the frontend container and the OS; 350M is the figure the kernel enforces against this process.

### Rule 3: Early File Size Rejection (50MB Limit)
*   Inspect the size of the uploaded file before writing it to disk. Immediately reject payloads exceeding **50MB** with an HTTP `400 Bad Request` error.

### Rule 4: Guaranteed Resource Destruction (Two Paths, Not `finally`)
*   Every request owns a temp directory that must always be destroyed, but the timing differs by path:
    *   **Error path:** clean up immediately inside `except`, before raising.
    *   **Success path:** register cleanup with `BackgroundTasks` so it runs *after* the response is sent.
*   **Do not wrap the response in a bare `finally`.** The endpoint returns a `FileResponse` that streams from the temp directory; a `finally` block deletes the payload before the client can read it.

### Rule 5: Bounded Extraction
*   Never call `ZipFile.extractall` on an upload. Use `app.services.archive.extract_bounded`, which enforces the decompressed-size limits and refuses members that resolve outside the destination directory.
*   The 50MB upload cap bounds what arrives, not what it becomes. Compressed size is not a proxy for memory use.

### Rule 6: Surgery Runs in a Child Process
*   Never call `run_graph_surgery` from the request path. Use `app.services.isolation.run_surgery_isolated`, which runs it in a child process under a timeout.
*   **Do not import `onnx` in `app/main.py` or anything it imports.** The parent process must not carry the library's resident footprint for the life of the container; only the child needs it.
*   A thread is not a substitute. Python threads cannot be interrupted, so a timed-out surgery would keep both its CPU and its memory.

### Rule 7: Verify Backend Changes in the Container
*   Run the backend suite in `build/test.Dockerfile`, not on the host. The backend spawns child processes and is bounded by container memory; a developer machine reproduces neither.
    ```bash
    docker build -f build/test.Dockerfile -t string_lights_backend_test .
    docker run --rm --memory=350m --memory-swap=350m string_lights_backend_test
    ```
*   Keep the memory flags. They mirror `build/docker-compose.yml`; without them the OOM path this code exists to prevent is never exercised.
*   Test-only dependencies belong in `requirements-dev.txt`. The production image must never carry a test runner.
*   **`apps/backend/venv` is not the production environment and is not expected to be.** It runs Python 3.14 with whatever `onnx` it resolved; the image runs Python 3.12 with the version pinned in `requirements.txt`. A green run in the venv says the code is syntactically sound and the logic holds on *some* `onnx` — it says nothing about the version that will ship. Use it to iterate; use the container to decide.

### Rule 8: Enforced Shape Inference and Validation
*   Always call `onnx.shape_inference.infer_shapes()` before streaming the modified model back to the client. This prevents the client-side session from failing due to missing tensor shape metadata.
*   **Never promote a tensor shape inference could not type.** A `TensorProto.UNDEFINED` output with no shape produces a graph `onnx.checker` rejects, and onnxruntime stalls on it rather than raising — the browser cannot report a malformed graph. Leave it out and list it in `unpromotableOutputNames`.
*   Always run `onnx.checker.check_model()` before saving. A model that would fail in the browser must fail here, as a `400` with a reason attached.

#### Reference implementation

`apps/backend/app/main.py` is the reference implementation of these rules.
This document does not copy its code, because a copy does not stay correct when the code changes.
Read these parts of `perform_surgery`:

*   The size check before the semaphore (Rule 3).
*   `surgery_semaphore` around the work of each request (Rule 2).
*   `extract_bounded` (Rule 5) and `run_surgery_isolated` (Rule 6).
*   The two cleanup paths: the `except` block for an error, and `BackgroundTasks` for a success (Rule 4).
*   The stable message for an unexpected error. The traceback goes only to the log. See [issue 013](../issues/013-error-responses-leak-internals.md).

---

## 2. Frontend (JavaScript/TypeScript/React)

### Rule 1: Release the InferenceSession before you load a new model
*   Before the worker loads a new model, call `release()` on the current `InferenceSession`. Then set the reference to `null`.
*   A change of the selected node does not load a new model. One run gives all intermediate tensors ([ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md)).
*   JavaScript code cannot start garbage collection. Remove each reference that you do not need. Then the browser can free the memory.

### Rule 2: Dispose of tensors after a run
*   After a run, call `dispose()` on each input tensor and each output tensor that has this method.
*   If a tensor does not have `dispose()`, remove the reference to it.
*   For a tensor on the GPU, `dispose()` releases the GPU buffer. Garbage collection does not release this buffer.

### Rule 3: Try WebGPU first, then WASM, in separate calls
*   Call `ort.InferenceSession.create` with `executionProviders: ['webgpu']`.
*   If this call throws an error, call it again with `executionProviders: ['wasm']`.
*   Do not put the two providers in one list. The worker must report which provider the session uses.
    One call with one list does not give the worker this information.
*   When the session uses WASM, show the badge `WASM Mode — Performance May Be Degraded`.

### Rule 4: Run inference in a Web Worker
*   Run each `session.run` call in the Web Worker. Also compute the tensor statistics there.
*   Then the UI thread does not stop during a run.

#### Reference implementation

`apps/web-app/src/ort-worker.ts` is the reference implementation of these rules.
Read these parts:

*   The `LOAD` case releases the old session. Then it tries WebGPU and WASM in separate calls (Rules 1 and 3).
*   The `RUN` case disposes of the tensors (Rule 2). It transfers the output buffers to the main thread and does not copy them.

---

## 3. Git & Version Control Conventions

### Rule 1: Conventional Commits
All commits must strictly adhere to the Conventional Commits specification.
*   **Format:**
    ```
    <type>(<scope>): <subject>

    <body>
    ```
*   **Types:**
    *   `feat`: A new feature implementation
    *   `fix`: A bug fix
    *   `docs`: Documentation-only updates
    *   `style`: Formatting, missing semicolons, structure changes with no code execution changes
    *   `refactor`: Code restructuring without fixing bugs or adding features
    *   `perf`: Performance-improving changes
    *   `test`: Adding or correcting tests
    *   `chore`: Tooling, configs, dependency updates, and boilerplate builds
*   **Rules:**
    *   **Subject:** Write in English, using the imperative mood (e.g., `fix: correct tensor release in worker`). Keep under 50 characters, and do not end with a period.
    *   **Body:** Separate the subject and body with a single blank line. Use the body to describe the detailed context, what was changed, and the motivation ("why") behind the change. Wrap body lines at 72 characters.

### Rule 2: Branching Strategy
*   **Strict Branch Limitation:** Only `main`, `develop`, and archiving branches (e.g., `legacy-v1`) are permitted in the repository. No other branch names (such as `feature/*` or `bugfix/*`) are allowed to be created.
*   **main Branch:** Reserved exclusively for finalized, production-ready code. Commits are pushed to `main` only when release elements are confirmed.
*   **develop Branch:** All active development, code revisions, and feature edits are conducted on this branch.
*   **Archiving Branches & Tags:** For large-scale or structural updates, or when keeping a snapshot of a major product version, use dedicated archiving branches (e.g., `legacy-v1`) and Git tags.
*   **Release Tags:** Annotated, `vMAJOR.MINOR.PATCH`, on `main`, applied **after** the deploy succeeds. The same version is set in `apps/backend/app/main.py` and `apps/web-app/package.json` in the release commit — see [05_deployment.md](./05_deployment.md) §4 for the full procedure and why all three move together.
*   **Merge Policy:** When development for a release is complete, merge changes from `develop` into `main`.

### Rule 3: Dependency Installation Limit
*   **No Unauthorized Dependencies:** Do not install any additional libraries, packages, tools, or frameworks unless it is during the initial environment setup or explicitly instructed by the user.

---

## 4. Next Documents
*   [CLAUDE.md (Required Session Rules & Trigger Routing)](../../CLAUDE.md)
*   [Project Overview (01_project_overview.md)](./01_project_overview.md)
*   [Terminology & Concepts (02_terminology.md)](./02_terminology.md)
*   [Architecture & Data Flow (03_architecture.md)](./03_architecture.md)
*   [Deployment & Certificate Lifecycle (05_deployment.md)](./05_deployment.md)

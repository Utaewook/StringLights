# Coding Rules

Obey these rules when you write code. The rules apply to developers and to AI assistants.

---

## 1. Backend (Python/FastAPI)

### Rule 1: Do not use an inference library in the backend
*   Do not import `onnxruntime` in the backend.
*   Use only `onnx`, for Graph Surgery and for shape inference.

### Rule 2: Use `Semaphore(1)` for Graph Surgery
*   Apply `asyncio.Semaphore(1)` to the Graph Surgery endpoint. Then only one surgery runs at a time.
*   The semaphore protects the memory limit of the backend container: **350M** (`build/docker-compose.yml`).
*   The host has 512MB. But the frontend container and the operating system also use that memory. The kernel applies the limit of 350M to the backend.

### Rule 3: Refuse a large upload early (upload limit: 50MB)
*   Examine the size of the uploaded file before you write it to disk.
*   If the file is larger than **50MB**, return `400 Bad Request` immediately.

### Rule 4: Delete the temporary directory on each path (do not use `finally`)
Each request has its own temporary directory. Always delete it. The time of the deletion depends on the path:
*   **Error path:** In the `except` block, delete the directory immediately. Then raise the error.
*   **Success path:** Register the deletion with `BackgroundTasks`. Then the deletion occurs after the backend sends the response.
*   **Do not put the response in a bare `finally` block.** The `FileResponse` streams from the temporary directory. A `finally` block deletes the file before the client reads it.

### Rule 5: Limit the extraction
*   Do not call `ZipFile.extractall` on an upload. Use `app.services.archive.extract_bounded`.
*   `extract_bounded` applies the extraction limits. It also refuses each member whose path goes outside the destination directory.
*   The upload limit controls the size of the archive. It does not control the size of the extracted files. The compressed size does not tell you the memory use.

### Rule 6: Run surgery in a child process
*   Do not call `run_graph_surgery` from the request path. Use `app.services.isolation.run_surgery_isolated`. This function runs the surgery in a child process, with a timeout.
*   **Do not import `onnx` in `app/main.py`, or in a module that it imports.** The parent process lives as long as the container. It must not keep the memory of the library. Only the child process needs `onnx`.
*   Do not use a thread in place of a child process. Python cannot stop a thread. If a surgery in a thread passes its timeout, the thread continues and keeps its CPU time and its memory.

### Rule 7: Verify backend changes in the container
*   Run the backend tests in `build/test.Dockerfile`, not on the host. The backend starts child processes, and the memory of the container limits it. A developer machine does not reproduce these conditions.
    ```bash
    docker build -f build/test.Dockerfile -t string_lights_backend_test .
    docker run --rm --memory=350m --memory-swap=350m string_lights_backend_test
    ```
*   Keep the memory flags. They are the same as the limits in `build/docker-compose.yml`. Without them, the tests do not reach the OOM path that this code prevents.
*   Put the dependencies for tests in `requirements-dev.txt`. Do not put a test runner in the production image.
*   **A local venv (`apps/backend/venv`) is not the production environment.**
    *   A local venv can use a different Python version and a different `onnx` version. The image uses Python 3.12 and the `onnx` version in `requirements.txt`.
    *   A pass in the venv shows that the code works with some version of `onnx`. It does not show that the code works with the version that ships.
    *   Use the venv to try a change. Use the container to make the decision.

### Rule 8: Run shape inference and validation
*   Call `onnx.shape_inference.infer_shapes()` before you return the changed model to the client. Without shape metadata, the session in the browser can fail.
*   **Do not promote a tensor that shape inference could not type.**
    *   A graph output with `TensorProto.UNDEFINED` and no shape makes a graph that `onnx.checker` refuses.
    *   onnxruntime can stop and not respond on such a graph. It does not raise an error, so the browser cannot report the problem.
    *   Do not promote the tensor. Put its name in `unpromotableOutputNames`.
*   Run `onnx.checker.check_model()` before you save the model. If a model can fail in the browser, it must fail here, as a `400` with the reason.

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

## 3. Git conventions

### Rule 1: Conventional Commits
Write each commit message in the Conventional Commits format.
*   **Format:**
    ```
    <type>(<scope>): <subject>

    <body>
    ```
*   **Types:**
    *   `feat`: a new feature
    *   `fix`: a bug fix
    *   `docs`: a change to documents only
    *   `style`: a change to the format of the code, with no change to its behavior
    *   `refactor`: a change to the structure of the code, with no new feature and no bug fix
    *   `perf`: a change that makes the code faster
    *   `test`: a new test, or a correction to a test
    *   `chore`: a change to tools, configuration, or dependencies
*   **Subject:** Write the subject in English, in the imperative mood. Example: `fix: correct tensor release in worker`. Use fewer than 50 characters. Do not put a period at the end.
*   **Body:** Put one blank line between the subject and the body. In the body, tell the context, the change, and the reason for the change. Wrap the lines at 72 characters.

### Rule 2: Branch strategy
*   **Permitted branches:** Use only `main`, `develop`, and archive branches (for example, `legacy-v1`). Do not make other branches, for example `feature/*` or `bugfix/*`.
*   **`main`:** This branch contains only code that is ready for production. Push to `main` only when the release is confirmed.
*   **`develop`:** Do all development on this branch.
*   **Archive branches and tags:** Use an archive branch (for example, `legacy-v1`) and a Git tag for a large change. Also use them to keep a snapshot of a major version.
*   **Release tags:** Use annotated tags in the format `vMAJOR.MINOR.PATCH`, on `main`. Apply the tag **after** the deploy succeeds.
    *   In the release commit, set the same version in `apps/backend/app/main.py` and in `apps/web-app/package.json`.
    *   For the procedure, see section 4 of [05_deployment.md](./05_deployment.md). That section also tells why the three versions change together.
*   **Merge policy:** When the work for a release is complete, merge `develop` into `main`.

### Rule 3: No new dependencies without approval
*   Do not install a library, a package, a tool, or a framework. There are two exceptions: the initial setup, and an install that the user requests.

---

## 4. Next documents
*   [CLAUDE.md (session rules and trigger routing)](../../CLAUDE.md)
*   [Project overview (01_project_overview.md)](./01_project_overview.md)
*   [Terminology (02_terminology.md)](./02_terminology.md)
*   [Architecture and data flow (03_architecture.md)](./03_architecture.md)
*   [Deployment and certificate lifecycle (05_deployment.md)](./05_deployment.md)
*   [Writing standard (06_writing_standard.md)](./06_writing_standard.md)

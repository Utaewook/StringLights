# AI Coding Rules (Must Follow)

Developers and AI assistants must strictly adhere to the following implementation rules and code skeletons when writing code.

---

## 1. Backend (Python/FastAPI)

### Rule 1: No Inference Libraries on Backend
*   Do not use `import onnxruntime` anywhere in the backend codebase.
*   Only use `import onnx` to manipulate graphs (Graph Surgery) and execute Shape Inference.

### Rule 2: Strict Queueing via Semaphore(1)
*   To protect the server memory (512MB RAM), apply `asyncio.Semaphore(1)` to the entry point of the Graph Surgery API endpoint to serialize concurrent operations.

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

### Rule 8: Enforced Shape Inference
*   Always call `onnx.shape_inference.infer_shapes()` before streaming the modified model back to the client. This prevents the client-side session from failing due to missing tensor shape metadata.

#### Recommended Backend Skeleton:
```python
import os
import uuid
import asyncio
from fastapi import (
    FastAPI, UploadFile, File, HTTPException, status, BackgroundTasks,
)
from fastapi.responses import FileResponse

app = FastAPI()
surgery_semaphore = asyncio.Semaphore(1)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
TEMP_ROOT = os.path.join(os.path.dirname(__file__), "temp")

@app.post("/api/surgery")
async def perform_graph_surgery(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    # 1. Early validation of file size
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the 50MB limit (Uploaded: {file_size / (1024*1024):.2f}MB)"
        )
    
    # Each request owns an isolated temp directory keyed by a UUID.
    temp_dir = os.path.join(TEMP_ROOT, str(uuid.uuid4()))
    os.makedirs(temp_dir, exist_ok=True)

    async with surgery_semaphore:
        try:
            # [Persist upload, run Graph Surgery, build the response payload...]

            # Success path: defer cleanup until AFTER the response is streamed.
            background_tasks.add_task(cleanup_directory, temp_dir)
            return FileResponse(output_path, media_type="application/zip")

        except Exception as e:
            # Error path: nothing is streamed, so destroy the directory now.
            cleanup_directory(temp_dir)
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {str(e)}",
            )
```

> The endpoint signature therefore takes `background_tasks: BackgroundTasks` as its
> first parameter. See `apps/backend/app/main.py` for the authoritative implementation.

---

## 2. Frontend (JavaScript/TypeScript/React)

### Rule 1: Explicit InferenceSession Release
*   When a user uploads a new ONNX model or switches intermediate nodes, call `.release()` on the existing `InferenceSession` instance to prevent memory leaks, then trigger garbage collection.

### Rule 2: Explicit Tensor Disposal
*   After the inference loop finishes, invoke `.dispose()` on all instantiated `ort.Tensor` objects (if supported) or assign them to `null` to ensure proper garbage collection.

### Rule 3: WebGPU Prioritization & WASM Fallback UI Badge
*   Initialize `ort.InferenceSession.create` with `executionProviders` ordered as `['webgpu', 'wasm']`.
*   If WebGPU setup fails or throws an exception, catch it, fall back to the WASM backend, and trigger a state update to render a warning status badge reading **"WASM Mode — Performance May Be Degraded"** in the layout.

### Rule 4: Offload Inference to Web Worker
*   To prevent UI blocking (freezing), encapsulate all `session.run` and heavy preprocessing logic inside a dedicated Web Worker thread.

#### Recommended Frontend Worker Skeleton:
```typescript
// ort-worker.ts (Session management pattern inside Web Worker)
import * as ort from 'onnxruntime-web';

let currentSession: ort.InferenceSession | null = null;

async function loadSession(modelBytes: Uint8Array) {
  if (currentSession) {
    try {
      await currentSession.release();
    } catch (e) {
      console.error("Failed to release session", e);
    }
    currentSession = null;
  }

  try {
    currentSession = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['webgpu'],
    });
    postMessage({ type: 'STATUS', provider: 'webgpu' });
  } catch (gpuError) {
    console.warn("WebGPU initialization failed, falling back to WASM", gpuError);
    try {
      currentSession = await ort.InferenceSession.create(modelBytes, {
        executionProviders: ['wasm'],
      });
      postMessage({ type: 'STATUS', provider: 'wasm' });
    } catch (wasmError) {
      postMessage({ type: 'ERROR', detail: 'Both WebGPU and WASM execution failed' });
    }
  }
}
```

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

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

### Rule 4: Guaranteed Resource Destruction via Try-Finally
*   To prevent temp files from polluting the server disk or memory, encapsulate file saves and Graph Surgery in `try-finally` blocks. Ensure cleanup is executed even if errors are raised.

### Rule 5: Enforced Shape Inference
*   Always call `onnx.shape_inference.infer_shapes()` before streaming the modified model back to the client. This prevents the client-side session from failing due to missing tensor shape metadata.

#### Recommended Backend Skeleton:
```python
import os
import shutil
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, status
import onnx

app = FastAPI()
surgery_semaphore = asyncio.Semaphore(1)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@app.post("/api/surgery")
async def perform_graph_surgery(file: UploadFile = File(...)):
    # 1. Early validation of file size
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the 50MB limit (Uploaded: {file_size / (1024*1024):.2f}MB)"
        )
    
    temp_in_path = f"temp_in_{file.filename}"
    temp_out_path = f"temp_out_{file.filename}"
    
    async with surgery_semaphore:
        try:
            with open(temp_in_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            try:
                model = onnx.load(temp_in_path)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Invalid ONNX model file: {str(e)}"
                )
            
            # [Execute Graph Surgery Logic here...]
            
            try:
                inferred_model = onnx.shape_inference.infer_shapes(model)
                onnx.save(inferred_model, temp_out_path)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"ONNX Shape inference failed: {str(e)}"
                )
            
        finally:
            if os.path.exists(temp_in_path):
                os.remove(temp_in_path)
            if os.path.exists(temp_out_path):
                os.remove(temp_out_path)
```

---

## 2. Frontend (JavaScript/TypeScript/React)

### Rule 1: Explicit InferenceSession Release
*   When a user uploads a new ONNX model or switches intermediate nodes, call `.release()` on the existing `InferenceSession` instance to prevent memory leaks, then trigger garbage collection.

### Rule 2: Explicit Tensor Disposal
*   After the inference loop finishes, invoke `.dispose()` on all instantiated `ort.Tensor` objects (if supported) or assign them to `null` to ensure proper garbage collection.

### Rule 3: WebGPU Prioritization & WASM Fallback UI Badge
*   Initialize `ort.InferenceSession.create` with `executionProviders` ordered as `['webgpu', 'wasm']`.
*   If WebGPU setup fails or throws an exception, catch it, fall back to the WASM backend, and trigger a state update to render a warning status badge reading **"WASM 모드 동작 중 - 성능 저하 가능"** in the layout.

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

---

## 4. Next Documents
*   [RULE.md (Required Session Rules)](file:///Users/twyou/Projects/string_lights/RULE.md)
*   [Project Overview (01_project_overview.md)](file:///Users/twyou/Projects/string_lights/docs/01_project_overview.md)
*   [Terminology & Concepts (02_terminology.md)](file:///Users/twyou/Projects/string_lights/docs/02_terminology.md)
*   [Architecture & Data Flow (03_architecture.md)](file:///Users/twyou/Projects/string_lights/docs/03_architecture.md)

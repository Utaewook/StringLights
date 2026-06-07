# StringLights v2 Session Rule & Checklist

This document details the rules and checklists that developers (and AI assistants) must read and follow at the start and end of each project session.

---

## 1. Session Start 3-Step Checklist

Follow these steps in order before starting any work.

### Step 1: Check Previous Session Status (on develop branch)
1. **Git Branch & Sync:** Ensure you are on the `develop` branch and sync with remote.
   ```bash
   git status
   git pull origin develop
   ```
2. **Review Recent Commits:**
   - Check the last 3-5 commits on `develop` to understand the progress made in the previous session.
   ```bash
   git log -n 5 --oneline
   ```
3. **Clean Workspace:** Ensure no temporary files or orphaned processes are left from previous sessions.

### Step 2: Prepare Local Development Environment
1. **Backend Environment Check** (`apps/backend` directory):
   - Activate virtual environment: `source venv/bin/activate` (create via `python -m venv venv` if missing).
   - Verify dependencies: `pip install -r requirements.txt`.
   - Default port: `8000`.
2. **Frontend Environment Check** (`apps/web-app` directory):
   - Verify dependencies: `npm install`.
   - Default port: `5173` (Vite) or `3000`.
3. **Port Conflict Check:** Ensure no background processes are occupying the default ports.

### Step 3: Core Constraints Self-Checklist
Verify that your changes satisfy these constraints:
*   [ ] **No Backend Inference:** Never import `onnxruntime` in backend code. Only use `onnx` for Graph Surgery.
*   [ ] **Strict Queueing:** Apply `asyncio.Semaphore(1)` to Graph Surgery API endpoints to prevent OOM.
*   [ ] **50MB Upload Limit:** Strict 50MB file size limit on backend uploads. Instantly reject with `400 Bad Request` if exceeded.
*   [ ] **Resource Cleanup:** Instantly delete all temporary files from memory/disk in a `finally` block on success or failure.
*   [ ] **Frontend Memory Management:** Call `release()` on existing `InferenceSession` before loading a new model, and explicitly dispose/nullify unused tensors.
*   [ ] **WebGPU Fallback & UX Badge:** Fallback to WASM automatically if WebGPU fails, and render a "WASM 모드 동작 중 - 성능 저하 가능" status badge in the UI.
*   [ ] **UI/UX Style Reference:** Reference the `legacy-v1` branch codebase to guide the frontend design, layouts, and styles.

---

## 2. Session End Checklist
Run these checks before wrapping up the session:
1. **Clean Workspace:** Ensure no temp files (like `temp_in_*` or `temp_out_*`) remain in the repository.
2. **Commit Branch Check:** Verify that changes are committed on the `develop` branch. Direct commits to `main` are strictly forbidden.
3. **Git Commit Message Format:** Write commits adhering strictly to Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `chore:`). See details in [AI Coding Rules (04_convention.md)](file:///Users/twyou/Projects/string_lights/docs/04_convention.md).

---

## 3. AI Assistant Specific Rules (Must Follow)
*   **Thinking Process:** The AI assistant must perform all reasoning/thinking in English.
*   **Response Language:** The AI assistant must respond/reply to the user only in Korean.
*   **Active Grilling:** The AI assistant must actively recommend and utilize the `/grill-me` process to resolve ambiguous designs, ask clarifying questions, and detail implementation steps before writing code.
*   **Style Reference:** The AI assistant must check and reference the UI/UX style of the `legacy-v1` branch before generating UI components.
*   **No Unauthorized Dependencies:** The AI assistant must never install new libraries, packages, or frameworks unless it is during the initial environment setup or explicitly requested by the user.

---

## 4. Reference Documents
*   [Project Overview (01_project_overview.md)](file:///Users/twyou/Projects/string_lights/docs/01_project_overview.md)
*   [Terminology (02_terminology.md)](file:///Users/twyou/Projects/string_lights/docs/02_terminology.md)
*   [Architecture & Data Flow (03_architecture.md)](file:///Users/twyou/Projects/string_lights/docs/03_architecture.md)
*   [AI Coding Rules (04_convention.md)](file:///Users/twyou/Projects/string_lights/docs/04_convention.md)

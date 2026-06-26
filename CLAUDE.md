# CLAUDE.md

This file serves as the **Trigger Router and Unified Guidelines Document** for AI assistants (Claude Code, Antigravity, etc.) operating in this repository.
It is loaded automatically at the start of each session. Detailed architectural concepts are delegated to `docs/*.md`, while this file provides a Single Source of Truth (SoT) for operational procedures and rules.

---

## 1. Runtime and Development Environment

- **Backend (`apps/backend`):** Python 3.12+ (FastAPI).
  - Dependencies: `requirements.txt` (`pip install -r requirements.txt`).
  - Run command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- **Frontend (`apps/web-app`):** Node 20+ (React, TS, Vite).
  - Dependencies: `package.json` (`npm install`).
  - Run command: `npm run dev` (Default port: `5173` or `3000`).
- **Production (`build`):** Docker & Nginx.
  - Build/Run: Operates based on `docker-compose.yml` and `Dockerfile` in the `/build` directory.

---

## 2. Trigger Routing

> Before modifying any of the paths/files below, **you must read the designated document first** to verify the architectural contracts.

| Target Path/File | Document to Read First | Notes / Core Constraints |
| --- | --- | --- |
| `apps/backend/app/services/**` (Graph manipulation) | `docs/03_architecture.md` | **Strictly NO ONNX inference on the server**. Apply `Semaphore(1)` for Graph Surgery. |
| `apps/backend/app/main.py` (API Entry Point) | `docs/01_project_overview.md` | **Strict 50MB upload limit**. Instantly return `400 Bad Request` if exceeded. |
| `apps/web-app/src/contexts/WorkerContext.tsx` | `docs/03_architecture.md` | Run `InferenceSession` inside Web Worker. Ensure explicit `release()` of session memory. |
| `apps/web-app/src/**` (Frontend UI modification) | `docs/01_project_overview.md` | Fallback to WASM if WebGPU is unsupported, and show status badge: "WASM 모드 동작 중 - 성능 저하 가능". |
| `build/**` (Docker & Nginx configuration) | `docs/03_architecture.md` | Nginx reverse proxy configuration and strict container memory limits. |
| Git branches, tags, and commits | `docs/04_convention.md` | Adhere to Conventional Commits format and branch strategy. |

---

## 3. Session Start 3-Step Checklist

Follow these steps in order when starting a work session.

### Step 1: Verify Git State and Sync (on `develop` branch)
1. Ensure you are on the `develop` branch and sync with the remote repository.
   ```bash
   git status
   git pull origin develop
   ```
2. Review the last 3-5 commits to understand recent progress.
   ```bash
   git log -n 5 --oneline
   ```
3. Ensure no temporary files or orphaned processes are left in the workspace.

### Step 2: Verify Local Development Environment
1. Check/activate Python virtual environment (`venv`) for backend, and verify port `8000`.
2. Check frontend dependencies (`npm install`) and verify port `5173`/`3000`.

### Step 3: Core Constraints Self-Check
- [ ] **No Backend Inference:** Never import or execute `onnxruntime` in the backend. Only use `onnx` for graph manipulation.
- [ ] **Strict Queueing:** Apply `asyncio.Semaphore(1)` to Graph Surgery API endpoints to limit concurrency.
- [ ] **50MB Upload Limit:** Enforce strict 50MB file size limit on backend uploads.
- [ ] **Resource Cleanup:** Delete all temporary files from memory/disk in a `finally` block on success or failure.
- [ ] **Frontend Memory Management:** Call `release()` on the existing `InferenceSession` before loading a new model, and explicitly dispose/nullify unused tensors.
- [ ] **WebGPU Fallback Badge:** Display the "WASM 모드 동작 중 - 성능 저하 가능" badge in the UI if WebGPU fails.

---

## 4. Session End Checklist

1. **Clean Workspace:** Ensure no temporary files (like `temp_in_*`, `temp_out_*`) remain in the repository.
2. **Branch Check:** All commits must be made to the `develop` branch. Direct commits to `main` are strictly forbidden.
3. **Commit Message:** Strictly adhere to the Conventional Commits specification (see details in `docs/04_convention.md`).

---

## 5. AI Assistant Specific Rules (Mandatory)

- **Thinking Language:** Perform all reasoning/thinking in **English**.
- **Response Language:** Reply to the user **only in Korean** using a polite and structured tone.
- **Strict No-Preemptive-Action Principle (Zero Proactive Edits):**
  **Do NOT proactively modify any source code, configuration files, or documents, and do NOT execute builds or commands unless the user has explicitly requested it.** You must not attempt to fix, refactor, or adjust anything preemptively on your own.
- **Collaborative Co-working Mindset:**
  Act as a collaborative partner. Thoroughly analyze user requirements, problems, and root causes first, and propose alternative solutions/plans before taking action.
- **Active Grilling (Resolve Ambiguity First):**
  Even for minor, trivial, or simple decisions, do not act preemptively. Proactively propose and utilize the `/grill-me` process to align with the user and verify designs before writing any code.
- **Style Reference:** Always check and reference the UI/UX style of the `legacy-v1` branch before generating UI components to maintain consistency.
- **No Unauthorized Installs:** Do not install any external libraries, packages, or frameworks unless during initial setup or explicitly approved by the user.
- **Atomic Commits:** Commit code in small, functional, and self-contained units. Do not bundle multiple features or bug fixes into a single commit.
- **Git History Honesty:** If you make a mistake (e.g., bundled commits, syntax errors), do not hide it using force-push (`git push -f`) or git resets. Disclose it transparently to the user and obtain permission before correcting it.

---

## 6. When to Invoke `/grill-me`

- When designing a new subsystem or major component for the first time.
- When the scope of a requirement or an issue is ambiguous or lacks detail.
- When multiple implementation options exist with different trade-offs.
- When changing API specifications, communication contracts, or the Graph Surgery logic.
- Before making *any* code or configuration change where user intent needs alignment.

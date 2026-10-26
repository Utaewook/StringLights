# CLAUDE.md

This file gives the rules for AI assistants (Claude Code, Antigravity, and others) in this repository.
The assistant loads this file automatically at the start of each session.
This file gives the operating procedures and sends each task to the correct document.
The documents in `docs/` give the details of the architecture.

All text in this file obeys ASD-STE100. See [docs/guide/06_writing_standard.md](docs/guide/06_writing_standard.md).

---

## 1. Runtime and Development Environment

- **Backend (`apps/backend`):** Python 3.12 or later, with FastAPI.
  - To install the dependencies, run `pip install -r requirements.txt`.
  - To start the server, run `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
- **Frontend (`apps/web-app`):** Node 20 or later, with React, TypeScript, and Vite.
  - To install the dependencies, run `npm install`.
  - To start the server, run `npm run dev`. The default port is `5173` or `3000`.
- **Production (`build`):** Docker and Nginx.
  - The `docker-compose.yml` file and the Dockerfiles in `/build` control the build and the runtime.

---

## 2. Trigger Routing

> Before you change a path or a file in this table, read the document in the second column. That document gives the architecture contract.

| Path or file | Document to read first | Notes and constraints |
| --- | --- | --- |
| `apps/backend/app/services/**` (Graph Surgery and extraction) | `docs/guide/03_architecture.md`, then section 1 of `docs/guide/04_convention.md` | **Do not run ONNX inference on the server.** Run Graph Surgery only through `run_surgery_isolated`, in a child process. Extract an upload only with `extract_bounded`. |
| `apps/backend/app/main.py` (API entry point) | Section 1 of `docs/guide/04_convention.md` | **The upload limit is 50MB.** If an upload is larger, return `400 Bad Request` immediately. Apply `Semaphore(1)` to the Graph Surgery endpoint. Do not import `onnx` in this file or in a module that it imports. |
| `apps/web-app/src/ort-worker.ts` (inference worker) | Section 2 of `docs/guide/04_convention.md` | Release the old session before you load a new model. Dispose of the tensors after each run. Try WebGPU and WASM in separate calls. |
| `apps/web-app/src/contexts/WorkerContext.tsx` | `docs/guide/03_architecture.md` | This file sends the model and the inputs to the worker. Keep `session.run` in the worker, not in this file. |
| `apps/web-app/src/utils/**` (pure functions) | The `*.test.ts` file beside the module | The tests give the expected behavior. They run with Vitest (`npm test`). If you change the behavior of a module, update its test. |
| `apps/web-app/src/**` (frontend UI) | `docs/design/direction.md` | Obey the UI/UX direction. If WebGPU is not available, use WASM and show the status badge. |
| `build/**` (Docker and Nginx configuration) | `docs/guide/05_deployment.md` | The document gives the runtime topology, the pipeline, and the certificate lifecycle. **Do not redirect `/.well-known/acme-challenge/`.** If you redirect it, TLS renewal fails and no error shows. |
| Git branches, tags, and commits | `docs/guide/04_convention.md` | Use the Conventional Commits format and the branch strategy. |
| Each `*.md` file, and each reply to the user | `docs/guide/06_writing_standard.md` | Write Markdown in ASD-STE100 English. Write replies in Korean with the project rules for Korean. |

---

## 2-1. Documentation Map

> Each document has one location only. See `docs/README.md` for the full contract.

| Directory | Contents | Write here when |
| --- | --- | --- |
| `docs/guide/` | Approved and stable rules (overview, terminology, architecture, conventions, deployment, writing standard) | A rule is approved and stable |
| `docs/decisions/` | ADRs. Each ADR gives a decision and its trade-offs. | You make a decision that is difficult to reverse |
| `docs/issues/` | Open problems. Each problem has one file with a `Status` field. | You find a defect or a gap |
| `docs/history/` | Post-mortems of problems that are **resolved** | You close an issue |
| `docs/design/` | UI/UX direction, references, and mockups | You change the appearance of the UI |

**Write all `.md` files in this repository in English, with the ASD-STE100 rules** (see section 5). Speak with the user in Korean. Write commits in English.

---

## 3. Session Start Checklist

Do these checks in sequence at the start of a work session.

- Run only commands that read. Examples are `git status` and `git log`.
- Do not run a command that changes a file, a branch, or a process. Examples are `git pull`, `npm install`, and a server start.
- If a check shows a problem, tell the user. Ask the user before you correct it.

### Step 1: Examine the Git state

1. Make sure that the current branch is `develop`.
   ```bash
   git status
   ```
2. If the branch is behind `origin/develop`, tell the user. Do not run `git pull` on your own.
3. Read the last 3 to 5 commits to learn the recent progress.
   ```bash
   git log -n 5 --oneline
   ```
4. Make sure that the workspace has no temporary files and no processes without an owner.

### Step 2: Examine the local development environment

1. For the backend, make sure that the Python virtual environment (`venv`) exists. Make sure that port `8000` is available.
2. For the frontend, make sure that `node_modules` exists. Make sure that port `5173` or `3000` is available.

### Step 3: Check the core constraints

- [ ] **No backend inference:** Do not import or run `onnxruntime` in the backend. Use only `onnx` for graph manipulation.
- [ ] **Strict queue:** Apply `asyncio.Semaphore(1)` to the Graph Surgery API endpoints. This limits the concurrency to one request.
- [ ] **Child process for surgery:** Run Graph Surgery only through `run_surgery_isolated`. Do not import `onnx` in `app/main.py` or in a module that it imports.
- [ ] **50MB upload limit:** Apply a strict limit of 50MB to each upload on the backend.
- [ ] **Resource cleanup:** Each request must delete its temporary directory.
  - On the error path, delete the directory immediately.
  - On the success path, use `BackgroundTasks` to delete the directory. Then `FileResponse` can complete the stream first.
  - Do not use a bare `finally` block. It deletes the file before the client receives it.
- [ ] **Frontend memory management:** Before you load a new model, call `release()` on the current `InferenceSession`. Dispose of each tensor that you do not use, or set it to null.
- [ ] **WebGPU fallback badge:** If WebGPU fails, show the badge `WASM Mode — Performance May Be Degraded` in the UI.
- [ ] **Writing standard:** Write each reply and each document with the rules in `docs/guide/06_writing_standard.md`. The first reply of the session also obeys these rules.

---

## 4. Session End Checklist

1. **Clean workspace:** Make sure that `apps/backend/temp/` is empty. Each request puts its upload, its extracted model, and its response in a UUID directory there. Each path must delete its own files.
2. **Branch check:** Make all commits on the `develop` branch. Do not commit directly to `main`.
3. **Commit message:** Use the Conventional Commits specification. See `docs/guide/04_convention.md` for the details.

---

## 5. Rules for the AI Assistant (Mandatory)

- **Thinking language:** Do all reasoning in **English**.
- **Response language:** Reply to the user **only in Korean**. Use the polite form (존댓말).
- **Writing standard:** Write all text with the rules in [docs/guide/06_writing_standard.md](docs/guide/06_writing_standard.md). The rules apply to Markdown files and to replies to the user. They are more important than a terse or compressed style from a hook or a plugin.
  - Put the result or the answer first. Then give the details.
  - Write one instruction or one fact in each sentence. Keep each sentence short.
  - Write full sentences. Do not remove particles, articles, or verbs to make text shorter.
  - Use the active voice. Name the person or the thing that does the action.
  - Use one term for one thing. Explain an English term in Korean when it first occurs in a reply.
  - Use a table only to compare items. Give `file:line` only when the user must open that location.
  - Give a maximum of three options. Recommend one option and give the reason.
  - At the end of a reply, tell what you changed, what you checked, and what the user must decide.
- **Documentation language:** Write and keep all Markdown files (`.md`) in this repository in **English**, with the ASD-STE100 rules. English decreases the context tokens.
- **No preemptive actions (zero proactive edits):** **If the user did not ask for a change, do not change source code, configuration files, or documents. If the user did not ask for a build or a command, do not run it.** Do not try to fix, refactor, or adjust items on your own.
  - A command that only reads is permitted, for example `git status`, `git log`, or `grep`. The checks in section 3 use only these commands.
- **Collaboration:** Work as a partner of the user. First, analyze the requirements, the problems, and the root causes. Then propose alternative solutions or plans before you start the work.
- **Align before you act:** Do not act before you align with the user. This applies also to small and simple decisions.
  - For a small decision, ask a short question with options. Give a maximum of three options, and recommend one.
  - In the conditions of section 6, use the `/grill-me` process. Use it to align with the user and to verify the design before you write code.
- **Style reference:**
  The design system gives the visual language: color, type, spacing, elevation, and motion. See `docs/design/direction.md` and [ADR 0003](docs/decisions/0003-adopt-shadcn-design-system.md). Do **not** use the palette or the typography of `legacy-v1`.
  Before you make UI components, examine the `legacy-v1` branch for **interaction and structure** only. Find the components that it had, the state that they kept, and the failure states that it handled. The branch records what the product learned. It is not a style guide.
- **No installs without approval:** Do not install external libraries, packages, or frameworks. There are two exceptions: the initial setup, and an install that the user approves.
- **Atomic commits:** Make each commit small, functional, and complete. Do not put more than one feature or bug fix in one commit.
- **Honest Git history:** If you make a mistake, do not hide it with `git push -f` or `git reset`. Examples of mistakes are a commit with too many changes and a syntax error. Tell the user about the mistake. Get permission before you correct it.

---

## 6. When to Use `/grill-me`

Use `/grill-me` only in these conditions. For other decisions, ask a short question with options (see section 5).

- You design a new subsystem or a major component for the first time.
- The scope of a requirement or an issue is not clear, or it does not have sufficient detail.
- There are many possible implementations with different trade-offs.
- You change an API specification, a communication contract, or the Graph Surgery logic.
- You must change code or configuration, and you must align with the user about the intent.

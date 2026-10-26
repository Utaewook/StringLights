# Project Overview: StringLights v2

## 1. Project Description
StringLights v2 is a web-based tool for visualizing and analyzing intermediate node computation results of ONNX deep learning and machine learning models. It migrates from the heavy server-side inference structure of v1 to a **Web Inference architecture** that leverages client-side browser resources.

## 2. Hardware Constraints (Extremely Critical)
The backend hosting server runs on an entry-level AWS Lightsail instance, which is a **resource-constrained environment with very low memory**.
*   **CPU:** 2 vCPU
*   **RAM:** 512MB on the host (Very high risk of OOM; Swap Memory enabled)
*   **Backend container RAM:** **350M** (`build/docker-compose.yml`). This, not the host figure, is the budget the backend is actually killed for exceeding — the host's 512MB is shared with the frontend container and the OS. Quote 350M whenever the number is about what the backend may use.
*   **Storage:** 20GB
*   **ONNX Upload Limit:** Uploads are capped at **50MB measured on the compressed archive**. What it expands into is bounded separately during extraction — see [issue 007](../issues/007-zip-extraction-has-no-size-limit.md).

## 3. Technology Stack
*   **Backend:** Python 3.12 or later, FastAPI, and `onnx`.
    *   The backend uses `onnx` only for Graph Surgery.
    *   Do not import or run `onnxruntime` on the server.
*   **Frontend:** React and TypeScript with Vite, and `onnxruntime-web` (WebGPU, with a WASM fallback).
    *   The styles are plain CSS. The design system is in `src/styles/ds/` ([ADR 0003](../decisions/0003-adopt-shadcn-design-system.md)).
    *   **Visual design:** Use [`docs/design/direction.md`](../design/direction.md) and ADR 0003. Do not use the palette or the typography of the `legacy-v1` branch.
    *   **Interaction and structure:** Use the `legacy-v1` branch only to learn the components, the state, and the failure states of the old UI.
*   **Infrastructure:** Docker, with a small FastAPI container and an Nginx proxy.

## 4. Version Control & Open Source Policy
*   **Git:** Track all configuration and code changes using Git. Follow Conventional Commits convention.
*   **Github:** Continuously sync codebase to the remote repository.
*   **Open Source Policy:** Compliant with Apache-2.0 license. Prevent license conflicts when introducing third-party libraries.

---

## 5. Next Documents
*   [CLAUDE.md (Required Session Rules & Trigger Routing)](../../CLAUDE.md)
*   [Terminology & Concepts (02_terminology.md)](./02_terminology.md)
*   [Architecture & Data Flow (03_architecture.md)](./03_architecture.md)
*   [AI Coding Rules (04_convention.md)](./04_convention.md)
*   [Deployment & Certificate Lifecycle (05_deployment.md)](./05_deployment.md)
*   [Writing Standard (06_writing_standard.md)](./06_writing_standard.md)

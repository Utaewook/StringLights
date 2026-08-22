# Project Overview: StringLights v2

## 1. Project Description
StringLights v2 is a web-based tool for visualizing and analyzing intermediate node computation results of ONNX deep learning and machine learning models. It migrates from the heavy server-side inference structure of v1 to a **Web Inference architecture** that leverages client-side browser resources.

## 2. Hardware Constraints (Extremely Critical)
The backend hosting server runs on an entry-level AWS Lightsail instance, which is a **resource-constrained environment with very low memory**.
*   **CPU:** 2 vCPU
*   **RAM:** 512MB (Very high risk of OOM; Swap Memory enabled)
*   **Storage:** 20GB
*   **ONNX Upload Limit:** To prevent server OOM, single ONNX file uploads are strictly limited to a **maximum of 50MB**.

## 3. Technology Stack
*   **Backend:** Python 3, FastAPI, `onnx` (For graph manipulation/surgery only. Never import or run `onnxruntime` on the server to maintain stability)
*   **Frontend:** HTML5, CSS (Vanilla CSS), JavaScript/TypeScript (React), `onnxruntime-web` (WebGPU / WASM fallback structure)
    *   *UI/UX Reference:* Refer to the `legacy-v1` branch for the interface design, styles, and dashboard layout references to ensure continuity.
*   **Infra:** Docker (Lightweight FastAPI container + Nginx proxy server)

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
# Terminology & Concepts

This document defines the core terms and concepts used in this project. Developers and AI assistants must strictly follow the context and constraints of these definitions when writing code.

*   **Graph Surgery:**
    *   The process of modifying the ONNX model structure to append or redirect a user-selected intermediate node as a new output node, enabling users to check intermediate computation results.
    *   **Constraint:** This operation is performed *only* on the backend (`apps/backend`) using the `onnx` library. Shape inference must be run immediately afterward. For detailed rules, see [AI Coding Rules (04_convention.md)](./04_convention.md).

*   **Web Inference:**
    *   Executing ONNX models directly in the user's web browser environment using `onnxruntime-web` to protect server resources and scale computationally.
    *   For the data flow pipeline, see [Architecture & Data Flow (03_architecture.md)](./03_architecture.md).

*   **WebGPU Fallback & WASM Mode Badge:**
    *   A fallback mechanism that automatically switches the execution engine to the WASM (WebAssembly) CPU backend if the browser does not support WebGPU acceleration or if initialization fails.
    *   **UX Requirement:** When running in WASM mode, a warning status badge reading "WASM Mode — Performance May Be Degraded" must be displayed on screen to inform users of potential performance lag.

---

## Next Documents
*   [CLAUDE.md (Required Session Rules & Trigger Routing)](../../CLAUDE.md)
*   [Project Overview (01_project_overview.md)](./01_project_overview.md)
*   [Architecture & Data Flow (03_architecture.md)](./03_architecture.md)
*   [AI Coding Rules (04_convention.md)](./04_convention.md)
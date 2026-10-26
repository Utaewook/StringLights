# Terminology

This document defines the core terms of this project.
Use each term with the meaning that this document gives.

---

## Graph Surgery

Graph Surgery changes an ONNX model so that its intermediate tensors are also graph outputs.
Then one inference run returns all of these tensors.

- The surgery promotes all intermediate tensors in one pass. The user does not select nodes. See [ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md).
- Shape inference runs before the promotion. The surgery promotes only the tensors that get a complete type from shape inference.
- The metadata lists each tensor that the surgery cannot promote in `unpromotableOutputNames`.
- The surgery does not promote the tensors inside a subgraph (`If`, `Loop`, or `Scan`). A subgraph runs only on a condition, so its tensors are not in the main graph.

**Constraints:**

- Only the backend (`apps/backend`) does Graph Surgery. It uses the `onnx` library.
- The surgery runs in a child process, with a timeout of 90 seconds.
- For the coding rules, see [04_convention.md](./04_convention.md).

## Web Inference

Web Inference runs the ONNX model in the browser of the user, with `onnxruntime-web`.
The server does not run inference. Thus, the small memory of the server stays free for Graph Surgery.

- The `InferenceSession` runs in a Web Worker. Thus, a large model does not stop the UI.
- For the data flow, see [03_architecture.md](./03_architecture.md).

## WebGPU fallback and the WASM Mode badge

The worker tries WebGPU first.
If the worker cannot create a WebGPU session, it creates a WASM (WebAssembly) session. A WASM session runs on the CPU.

When the session uses WASM, the UI shows the badge `WASM Mode — Performance May Be Degraded`.
The badge tells the user that inference can be slow.

---

## Next documents

- [CLAUDE.md (session rules and trigger routing)](../../CLAUDE.md)
- [Project overview (01_project_overview.md)](./01_project_overview.md)
- [Architecture and data flow (03_architecture.md)](./03_architecture.md)
- [Coding rules (04_convention.md)](./04_convention.md)
- [Deployment and certificate lifecycle (05_deployment.md)](./05_deployment.md)

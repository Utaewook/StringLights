# Project Overview: StringLights v2

## 1. Project description

StringLights v2 is a web tool. It shows the intermediate tensors of an ONNX model, so that you can analyze them.
Version 1 ran inference on the server.
Version 2 uses Web Inference: the browser of the user runs the model. The server only does Graph Surgery.

## 2. Hardware limits (critical)

The backend runs on a small AWS Lightsail instance. The instance has very little memory.

- **CPU:** 2 vCPU.
- **Host memory:** 512MB. Swap memory is enabled. The risk of OOM is very high.
- **Memory of the backend container:** 350M (`build/docker-compose.yml`).
  - If the backend uses more than 350M, the kernel stops it. The host memory of 512MB is not the limit of the backend.
  - The frontend container and the operating system also use the memory of the host.
  - When you write about the memory that the backend can use, write 350M.
- **Storage:** 20GB.
- **Upload limit:** 50MB, on the compressed ZIP file. The extraction limit controls the size of the extracted files. See [issue 007](../issues/007-zip-extraction-has-no-size-limit.md).

## 3. Technology stack

- **Backend:** Python 3.12 or later, FastAPI, and `onnx`.
  - The backend uses `onnx` only for Graph Surgery.
  - Do not import or run `onnxruntime` on the server.
- **Frontend:** React and TypeScript with Vite, and `onnxruntime-web` (WebGPU, with a WASM fallback).
  - The styles are plain CSS. The design system is in `src/styles/ds/` ([ADR 0003](../decisions/0003-adopt-shadcn-design-system.md)).
  - **Visual design:** Use [`docs/design/direction.md`](../design/direction.md) and ADR 0003. Do not use the palette or the typography of the `legacy-v1` branch.
  - **Interaction and structure:** Use the `legacy-v1` branch only to learn the components, the state, and the failure states of the old UI.
- **Infrastructure:** Docker, with a small FastAPI container and an Nginx proxy.

## 4. Version control and license

- **Git:** Keep all code and configuration in Git. Use the Conventional Commits format. See [04_convention.md](./04_convention.md).
- **GitHub:** Synchronize the code with the remote repository on GitHub regularly.
- **License:** The project uses the Apache-2.0 license. Before you add a third-party library, make sure that its license is compatible with Apache-2.0.

---

## 5. Next documents

- [CLAUDE.md (session rules and trigger routing)](../../CLAUDE.md)
- [Terminology (02_terminology.md)](./02_terminology.md)
- [Architecture and data flow (03_architecture.md)](./03_architecture.md)
- [Coding rules (04_convention.md)](./04_convention.md)
- [Deployment and certificate lifecycle (05_deployment.md)](./05_deployment.md)
- [Writing standard (06_writing_standard.md)](./06_writing_standard.md)

# StringLights web app

This directory contains the frontend of StringLights.
The frontend uses React, TypeScript, and Vite. It runs the model in the browser with `onnxruntime-web`.
For the project overview, see the [root README](../../README.md).

## Commands

Use Node 20 or later. Run these commands in this directory.

| Command | What it does |
| --- | --- |
| `npm install` | Installs the dependencies. |
| `npm run dev` | Starts the Vite development server. Vite sends `/api` requests to the backend on port `8000`. |
| `npm run build` | Copies the WASM files of `onnxruntime-web` to `public/`. Then it type-checks with `tsc -b` and builds with Vite. |
| `npm run lint` | Runs ESLint. |
| `npm test` | Runs the unit tests with Vitest. |
| `npm run preview` | Serves the built files. |

## Source structure

| Path | Contents |
| --- | --- |
| `src/ort-worker.ts` | The Web Worker. It loads the session and runs inference. |
| `src/contexts/WorkerContext.tsx` | Sends the model and the inputs to the worker, and receives the results. |
| `src/features/inference/` | The panel for the upload, the synthetic inputs, and the run. |
| `src/features/inspector/` | The inspector of the selected node. |
| `src/components/layout/` | The page layout, the header, the sidebar, and the playback bar. |
| `src/components/common/` | The graph canvas and the toasts. |
| `src/components/ui/` | Components from the design system. See [its README](src/components/ui/README.md). |
| `src/store/` | The Zustand stores: model, playback, and UI. |
| `src/utils/` | Helper functions. Most of them have a `*.test.ts` file beside them. |
| `src/styles/ds/` | The vendored design system. See [its README](src/styles/ds/README.md). |
| `src/types/` | The shared TypeScript types. |

## Rules

Read these documents before you change the frontend:

- [Coding rules, section 2](../../docs/guide/04_convention.md): the session, the tensors, and the execution providers.
- [Architecture](../../docs/guide/03_architecture.md): the data flow between the browser and the backend.
- [Design direction](../../docs/design/direction.md): the visual design of the UI.
- [Terminology](../../docs/guide/02_terminology.md): the names to use for each part of the app.

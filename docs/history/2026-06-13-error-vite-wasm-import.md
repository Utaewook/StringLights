# ONNX Runtime Web Worker Initialization Failure (Vite public import restriction)

- **Date:** 2026-06-13
- **Type:** Error

## Context
The application uses `onnxruntime-web` (v1.26) within a React/Vite frontend to run ML models in the browser. To leverage multi-threading and WebGPU, ORT initializes Web Workers. Vite serves as the local development server.

## Issue/Requirement
When attempting to load an ONNX model via the frontend, the application consistently threw the following error:
`Model load failed: no available backend found. ERR: [wasm] Error: previous call to 'initWasm()' failed.`

## Investigation
1. **SharedArrayBuffer Headers:** Initial investigation revealed that Vite was not sending the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers, which are mandatory for `SharedArrayBuffer` usage in multi-threaded WASM. These were added to `vite.config.ts`, but the error persisted.
2. **Missing Assets:** Vite dev server logs revealed an underlying error: `Failed to fetch dynamically imported module: /ort-wasm-simd-threaded.jsep.mjs?import`. The build script (`scripts/copy-wasm.cjs`) was only copying `.wasm` files, completely missing the `.mjs` wrapper modules ORT requires to spawn threads.
3. **Vite's Strict Public Folder Rule:** After modifying the script to copy the `.mjs` files into the `public/` folder, a new Vite-specific error occurred:
   `This file is in /public and will be copied as-is during build without going through the plugin transforms, and therefore should not be imported from source code.`
   Vite strictly forbids JS modules from dynamically importing files located in the `public/` directory.
4. **Optimization Exclusion Failure:** Excluding `onnxruntime-web` via `optimizeDeps.exclude` was attempted. However, because the library was still imported via source code (`ort-worker.ts`), Vite intercepted the file on the fly and automatically appended `?import` to the dynamic `import()` calls inside ORT, triggering the same `public/` restriction error.

## Resolution
Avoided placing the `.mjs` files in the `public/` folder during development. Instead, the `wasmPaths` configuration in `ort-worker.ts` was dynamically branched based on the environment:

```typescript
ort.env.wasm.wasmPaths = import.meta.env.DEV 
  ? '/node_modules/onnxruntime-web/dist/' 
  : '/';
```

By pointing directly to the `node_modules` directory during development (`import.meta.env.DEV`), Vite serves the `.mjs` files as standard node modules rather than static assets from `public/`, cleanly bypassing the import restriction. In production builds, the fallback path `/` is used, successfully loading the static assets that are emitted into the root of the `dist/` directory.

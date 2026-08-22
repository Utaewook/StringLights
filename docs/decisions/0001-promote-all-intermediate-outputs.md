# 0001. Promote every intermediate node to a graph output

- **Status:** Accepted
- **Date:** 2026-08-22 (documents behaviour already in `main`)

## Context

The product exists to show the actual tensor values flowing through a model. To read an
intermediate activation with ONNX Runtime, that tensor has to be a graph output — the
runtime does not expose interior values otherwise.

Two shapes were possible: let the user pick which nodes to expose and run surgery per
selection, or expose everything once.

## Decision

`run_graph_surgery` appends **every** node output that is not already a graph output,
in a single pass (`apps/backend/app/services/surgery.py:217-233`).

## Consequences

### What this buys

- One round trip to the 512MB server per model. Selecting a different node afterwards is
  free — no re-upload, no second surgery, no queue wait behind `Semaphore(1)`.
- The playback feature works at all: stepping through the graph requires every
  activation to be present simultaneously.

### What this costs

- **ONNX Runtime loses most memory planning.** Every intermediate tensor is a live graph
  output, so buffer reuse and node fusion are largely unavailable.
- **Peak memory is the sum of all activations**, not the maximum live set.
- The worker sends results with `postMessage` **without a transfer list**
  (`apps/web-app/src/ort-worker.ts`), so every buffer is structurally cloned, then held
  again in the Zustand store — roughly 2–3× the raw activation size in the tab.
- **The practical model-size ceiling is browser memory, not the 50MB upload limit.** The
  server-side cap says nothing about whether a given model can actually be inspected.

## Alternatives considered

- **Selective promotion.** Lower memory, but re-runs surgery on every selection change,
  which serialises behind `Semaphore(1)` and re-uploads the model.
- **Streaming activations per step.** Would bound memory, but requires re-running
  inference for each step and rules out instant scrubbing.

## Open questions

- What is the real ceiling? No measurement exists yet. This must be established before
  demo models are chosen — ResNet-18 and Tiny YOLO are unverified assumptions.
- Would a transfer list on `postMessage` remove one full copy at negligible cost?
- Should very large graphs fall back to selective promotion automatically?

This ADR is also a candidate root cause for
[../issues/001-model-load-hang.md](../issues/001-model-load-hang.md).

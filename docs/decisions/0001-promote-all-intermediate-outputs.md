# 0001. Promote all intermediate tensors to graph outputs

- **Status:** Accepted
- **Date:** 2026-08-22. This ADR records behavior that is already in `main`.

## Context

The purpose of the product is to show the real values of the tensors that go through a model.
To read an intermediate tensor with ONNX Runtime, that tensor must be a graph output.
ONNX Runtime does not give the values of other tensors.

Two designs were possible:

- Let the user select the nodes to promote. Then run the surgery again for each selection.
- Promote all intermediate tensors one time.

## Decision

`run_graph_surgery` adds **all** node outputs to the graph outputs, in one pass (`apps/backend/app/services/surgery.py:217-233`).
It does not add a node output that is already a graph output.

## Consequences

### Advantages

- The app sends each model to the 512MB server one time.
  After that, the user can select a different node with no more work on the server:
  - The app does not upload the model again.
  - The surgery does not run again.
  - There is no wait in the queue of `Semaphore(1)`.
- The playback is possible. The playback steps through the graph. Thus, it needs all intermediate tensors at the same time.

### Disadvantages

- **ONNX Runtime cannot do most of its memory planning.** Each intermediate tensor is a graph output, so it stays in memory.
  Thus, ONNX Runtime cannot reuse most buffers or fuse most nodes.
- **The peak memory is the sum of all intermediate tensors.** It is not the largest set of tensors that are in use at one time.
- The worker sends the results with `postMessage` **without a transfer list** (`apps/web-app/src/ort-worker.ts`).
  Thus, the browser makes a structured clone of each buffer. Then the Zustand store keeps the buffers again.
  The tab uses approximately 2–3× the raw size of the intermediate tensors.
- **In practice, the memory of the browser limits the model size, not the upload limit of 50MB.**
  The upload limit on the server does not tell you if you can examine a given model.

## Other options

- **Selective promotion.** This option uses less memory.
  But the surgery runs again each time that the selection changes.
  Each run waits behind `Semaphore(1)`, and the app uploads the model again.
- **Streaming of intermediate tensors for each step.** This option would limit the memory.
  But it requires a new inference run for each step.
  It also prevents a move to any step with no delay.

## Open questions

- What is the real limit? No measurement exists yet.
  The project must find the limit before it selects the demo models.
  ResNet-18 and Tiny YOLO are assumptions, not measured results.
- Would a transfer list on `postMessage` remove one full copy at a very small cost?
- Should the app change to selective promotion automatically for very large graphs?

The decision in this ADR is also a possible root cause of [issue 001](../issues/001-model-load-hang.md).

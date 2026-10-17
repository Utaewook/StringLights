# Replay steps one node at a time, even through independent branches

- **Status:** Open
- **Severity:** Low
- **Track:** Feature
- **Found:** 2026-10-17
- **Related:** [../decisions/0001-promote-all-intermediate-outputs.md](../decisions/0001-promote-all-intermediate-outputs.md), [010](./010-subgraph-nodes-never-surfaced.md), [../design/demo-recording.md](../design/demo-recording.md)

## Symptom

Where the graph branches, replay walks one branch to the end before starting the other.
In SqueezeNet 1.1's first Fire module the highlight goes `conv2 → relu2 → conv3 → relu3 →
concat0`: the two branches look as if one depends on the other, and the order between them
is whatever order the exporter wrote the nodes in.

The wanted behaviour: one step per **dependency depth**. Nodes at the same depth light up
together, so `conv2` and `conv3` share a step, then `relu2` and `relu3`, then `concat0`.

Found while recording the README demo; the shot is to be re-recorded once this is fixed.

## Evidence

Steps are built one per node, in `graph.node` order. The backend lists nodes in file order
(`apps/backend/app/services/surgery.py:166`), and the store keeps that order:

```ts
// apps/web-app/src/store/playbackStore.ts — setTraceData
const trace: TraceStep[] = nodes
  .map((node) => {
    const key = node.outputs.find((k) => valid.has(k));
    return key ? { nodeName: node.name, outputTensorKey: key } : null;
  })
```

Every path that moves the playhead — `tick`, `seekStep`, `setCurrentStep`, and the end of
playback — highlights exactly one node with `new Set([trace.nodeName])`. `activeNodeNames`
is already a `Set`, and `GraphCanvas.tsx:145` already tests membership, so the canvas can
draw several highlighted nodes without change.

Measured on `squeezenet1.1-7.onnx` (depth = 1 + the deepest producer among a node's inputs;
graph inputs and initializers are depth −1):

| | Count |
| --- | --- |
| Nodes, so steps today | 66 |
| Depth levels, so steps after | 50 |
| Levels holding more than one node | 16 — two per Fire module, two nodes each |

## Suspected cause

Not a defect. Replay was written as a list of nodes, and a list has no notion of two things
happening at once.

## Impact

The replay implies an ordering between independent branches that the model does not have,
and that is what a viewer reads off the demo GIF. No numbers are wrong.

**What depth does not mean.** onnxruntime-web runs this app's sessions with the default
`executionMode: 'sequential'` (`apps/web-app/src/ort-worker.ts:29-37` sets nothing else): one
kernel at a time on both WebGPU and WASM. GPU parallelism is inside a kernel, not across
nodes. Same-depth nodes are nodes that *could* run together, not nodes that *did*. The
runtime's actual kernel order was not observed and may differ from both file order and depth
order. The feature visualises dependency structure; nothing in the UI or the README may
describe it as concurrent execution.

## Resolution criteria

1. A pure function in `apps/web-app/src/utils/` groups nodes by depth, computed from node
   inputs and outputs. Graph inputs and initializers produce nothing. Unit-tested in vitest,
   including a diamond (`a → {b, c} → d` gives three steps) and a chain (one node per step).
2. Every playhead path — play, step forward and back, scrub, and end of playback — highlights
   every traceable node at the current depth.
3. Depth is computed over the whole graph, but a level is a step only if it holds at least one
   traceable node — today's filter on promoted outputs still applies. A level with none is
   skipped rather than shown empty.
4. The step counter, the slider range and the speed control count levels, not nodes. On
   SqueezeNet 1.1 the bar reads **50 steps**.
5. Nodes inside control-flow subgraphs ([010](./010-subgraph-nodes-never-surfaced.md)) either
   get a defined depth or are left out of replay, and which one is stated here on closing.
6. No UI text, tooltip or README sentence calls same-depth nodes simultaneous or parallel.

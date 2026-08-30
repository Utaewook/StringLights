# Nodes inside If/Loop/Scan subgraphs are never surfaced

- **Status:** Closed
- **Severity:** Medium
- **Track:** Bug
- **Found:** 2026-08-22
- **Related:** [../decisions/0001-promote-all-intermediate-outputs.md](../decisions/0001-promote-all-intermediate-outputs.md)

## Symptom

For a model containing control flow, the nodes inside the branch or body subgraphs do not
appear in the graph view and their activations cannot be inspected. No warning is shown —
the model simply looks smaller than it is.

## Evidence

Both places that walk the graph iterate top-level nodes only:

```python
# apps/backend/app/services/surgery.py:115  (metadata extraction)
for idx, node in enumerate(graph.node):
```

```python
# apps/backend/app/services/surgery.py:217  (output promotion)
for node in inferred_model.graph.node:
```

`If`, `Loop`, and `Scan` carry their bodies in graph-valued attributes
(`then_branch`, `else_branch`, `body`). Neither loop descends into them, so those nodes
are absent from the node list sent to the frontend *and* absent from output promotion.

The attribute reader at `surgery.py:119-133` handles `f`, `i`, `s`, `ints`, `floats`, and
`strings`, and falls through to `"<unsupported type>"` for anything else — which is what a
graph-valued attribute becomes.

## Impact

Directly contradicts the premise recorded in
[ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md): that every intermediate
tensor is exposed. For a model with control flow the tool silently shows an incomplete
graph, and the user has no signal that anything is missing.

Severity is Medium rather than High only because the affected models are a minority.
The failure mode — silently wrong output presented as complete — is worse than an error.

## Resolution criteria

Either:

- **(a)** recurse into graph-valued attributes for both metadata extraction and output
  promotion, being explicit about how subgraph outputs are named and scoped, or
- **(b)** detect control-flow ops during surgery and tell the user, in the UI, that the
  interior of those nodes is not inspectable.

Option (b) is the smaller change and removes the silent-incompleteness problem, which is
the part that matters. Option (a) is the full fix and should be recorded in an ADR if the
naming/scoping trade-off turns out to be real.

## Resolution

`collect_nodes` in `surgery.py` walks node attributes recursively, so operators
inside `then_branch`, `else_branch` and `body` now reach the client. Each
carries the path that reached it and `inspectable: false`, and the metadata
reports `subgraphNodeCount`.

The client says so in both places it matters: a toast on load reports how many
nodes are affected, and the inspector shows a persistent warning naming the
subgraph when one is selected.

Subgraph tensor names are prefixed with the same path. ONNX permits a subgraph
to shadow an outer name, and the client builds its edges from a flat map of
tensor name to producing node — an unprefixed collision would have silently
rewired the top-level graph, which is a worse failure than the one being fixed.
The cost is that a reference from a subgraph out to an enclosing tensor no
longer resolves, so that edge is not drawn.

Verified in `build/test.Dockerfile` by `TestSubgraphSurfacing`: an If model's
branch operators appear under their paths, are marked uninspectable while
top-level nodes are not, their tensor names are scoped, and the saved model
still passes `onnx.checker`.

## What is deliberately not fixed

Activations inside a subgraph still cannot be inspected, and that is a property
of ONNX rather than a defect here — a subgraph executes conditionally and its
tensors do not exist in the enclosing scope, so they cannot be promoted to graph
outputs. Real inspection would mean extracting each subgraph as its own model
and running it separately, which is a feature, not a fix. The issue closes
because the nodes are no longer invisible and the limitation is no longer
silent.

# Nodes inside If/Loop/Scan subgraphs are never surfaced

- **Status:** Open
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

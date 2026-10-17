import type { OnnxNode, TraceStep } from '../types';

/**
 * Groups graph nodes into replay steps by dependency depth.
 *
 * Replay used to be one step per node, taken in the order the exporter wrote
 * them. Where a graph branches that implies an ordering the model does not
 * have: in a Fire module, `conv2` and `conv3` consume the same tensor and
 * neither waits for the other, but one was shown finishing before the other
 * started. See docs/issues/020-replay-steps-one-node-at-a-time.md.
 *
 * Same depth means *no dependency between them*. It does not mean they run at
 * the same time — onnxruntime executes one kernel at a time here, and this
 * function describes the graph, not the runtime.
 */

/**
 * Depth of every node, keyed by name.
 *
 * One pass, because ONNX requires the node list to be topologically ordered and
 * `run_graph_surgery` runs `onnx.checker.check_model` before saving the model
 * the client receives. Every input is therefore produced by a node already
 * seen, so there is nothing to recurse into and no cycle to guard against.
 *
 * An input with no producer — a graph input or an initializer — contributes
 * nothing, which leaves a node fed only by those at depth 0.
 */
export function nodeDepths(nodes: readonly OnnxNode[]): Map<string, number> {
  const depthOfTensor = new Map<string, number>();
  const depthOfNode = new Map<string, number>();

  for (const node of nodes) {
    let depth = 0;
    for (const input of node.inputs) {
      const producerDepth = depthOfTensor.get(input);
      if (producerDepth !== undefined) {
        depth = Math.max(depth, producerDepth + 1);
      }
    }

    depthOfNode.set(node.name, depth);
    for (const output of node.outputs) {
      depthOfTensor.set(output, depth);
    }
  }

  return depthOfNode;
}

/**
 * The replay steps for one run.
 *
 * Depth is computed over every node, but a node only appears in a step if the
 * run actually returned one of its outputs. A node whose output could not be
 * promoted — see issue 001 — is still a producer and still pushes the nodes
 * after it deeper; it simply has nothing to show. Nodes inside control-flow
 * subgraphs fall out the same way: their tensors are never promoted, so they
 * are excluded without a rule of their own (issue 010).
 *
 * A depth holding no traceable node is dropped rather than shown empty, so a
 * step index is not a depth.
 */
export function buildReplaySteps(
  nodes: readonly OnnxNode[],
  outputKeys: readonly string[],
): TraceStep[] {
  const available = new Set(outputKeys);
  const depths = nodeDepths(nodes);
  const byDepth = new Map<number, string[]>();

  for (const node of nodes) {
    if (!node.outputs.some((output) => available.has(output))) continue;

    const depth = depths.get(node.name) ?? 0;
    const names = byDepth.get(depth);
    if (names) {
      names.push(node.name);
    } else {
      byDepth.set(depth, [node.name]);
    }
  }

  return [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, nodeNames]) => ({ depth, nodeNames }));
}

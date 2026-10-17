import type { Node } from 'reactflow';

/**
 * Marks the canvas nodes that belong to the current replay step.
 *
 * Every node is decided on its own: membership of `activeNodeNames` is tested
 * per node, so a step holding several nodes highlights all of them. That is the
 * behaviour issue 020 is about, and it lives here rather than inline in
 * `GraphCanvas`'s effect so it can be executed by a test.
 *
 * `stepNonce` rides along so a step that highlights the same nodes as the last
 * one still produces new node objects and re-triggers the flash animation.
 */
export function applyHighlight<T extends Node>(
  nodes: readonly T[],
  activeNodeNames: ReadonlySet<string>,
  stepNonce: number,
): T[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isHighlighted: activeNodeNames.has(node.data.label),
      stepNonce,
    },
  }));
}

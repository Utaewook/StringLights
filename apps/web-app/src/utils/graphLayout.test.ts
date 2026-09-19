import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { getLayoutedElements } from './graphLayout';

const chain = (count: number): { nodes: Node[]; edges: Edge[] } => ({
  nodes: Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    position: { x: 0, y: 0 },
    data: { label: `node ${i}` },
  })),
  edges: Array.from({ length: count - 1 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
  })),
});

describe('getLayoutedElements', () => {
  it('assigns every node a finite position', () => {
    const { nodes, edges } = chain(5);

    const out = getLayoutedElements(nodes, edges);

    expect(out.nodes).toHaveLength(5);
    for (const node of out.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });

  it('lays a chain out left to right by default', () => {
    const { nodes, edges } = chain(4);

    const xs = getLayoutedElements(nodes, edges).nodes.map((n) => n.position.x);

    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('lays a chain out top to bottom when asked', () => {
    const { nodes, edges } = chain(4);

    const ys = getLayoutedElements(nodes, edges, 'TB').nodes.map((n) => n.position.y);

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    }
  });

  it('sets handle sides to match the direction', () => {
    const { nodes, edges } = chain(2);

    const lr = getLayoutedElements(nodes, edges, 'LR').nodes[0];
    const tb = getLayoutedElements(nodes, edges, 'TB').nodes[0];

    expect([lr.targetPosition, lr.sourcePosition]).toEqual(['left', 'right']);
    expect([tb.targetPosition, tb.sourcePosition]).toEqual(['top', 'bottom']);
  });

  it('does not mutate the nodes it was given', () => {
    const { nodes, edges } = chain(3);
    const before = JSON.stringify(nodes);

    getLayoutedElements(nodes, edges);

    expect(JSON.stringify(nodes)).toBe(before);
  });

  it('returns the same edges it was handed', () => {
    const { nodes, edges } = chain(3);

    expect(getLayoutedElements(nodes, edges).edges).toBe(edges);
  });

  it('handles a single node with no edges', () => {
    const out = getLayoutedElements(
      [{ id: 'only', position: { x: 0, y: 0 }, data: {} }],
      [],
    );

    expect(out.nodes).toHaveLength(1);
    expect(Number.isFinite(out.nodes[0].position.x)).toBe(true);
  });

  it('separates parallel branches rather than stacking them', () => {
    const nodes: Node[] = ['root', 'a', 'b'].map((id) => ({
      id, position: { x: 0, y: 0 }, data: {},
    }));
    const edges: Edge[] = [
      { id: 'e1', source: 'root', target: 'a' },
      { id: 'e2', source: 'root', target: 'b' },
    ];

    const out = getLayoutedElements(nodes, edges);
    const a = out.nodes.find((n) => n.id === 'a')!;
    const b = out.nodes.find((n) => n.id === 'b')!;

    expect(a.position.y).not.toBe(b.position.y);
  });
});

import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import { applyHighlight } from './graphHighlight';
import { usePlaybackStore } from '../store/playbackStore';
import type { OnnxNode } from '../types';

const canvasNode = (label: string): Node => ({
  id: label,
  position: { x: 0, y: 0 },
  data: { label, isHighlighted: false, stepNonce: 0 },
});

const graphNode = (name: string, inputs: string[], outputs: string[]): OnnxNode =>
  ({ name, opType: 'Op', inputs, outputs });

const highlighted = (nodes: Node[]) =>
  nodes.filter((n) => n.data.isHighlighted).map((n) => n.data.label).sort();

describe('applyHighlight', () => {
  it('highlights every node named in the set, not just the first', () => {
    const nodes = [canvasNode('a'), canvasNode('b'), canvasNode('c')];

    expect(highlighted(applyHighlight(nodes, new Set(['b', 'c']), 1))).toEqual(['b', 'c']);
  });

  it('clears nodes that are no longer in the set', () => {
    const lit = applyHighlight([canvasNode('a'), canvasNode('b')], new Set(['a', 'b']), 1);

    expect(highlighted(applyHighlight(lit, new Set(['a']), 2))).toEqual(['a']);
  });

  it('leaves everything unlit for an empty set', () => {
    expect(highlighted(applyHighlight([canvasNode('a')], new Set(), 1))).toEqual([]);
  });

  it('returns new objects so the flash re-triggers on an identical step', () => {
    const nodes = [canvasNode('a')];
    const first = applyHighlight(nodes, new Set(['a']), 1);
    const second = applyHighlight(first, new Set(['a']), 2);

    expect(second[0]).not.toBe(first[0]);
    expect(second[0].data.stepNonce).toBe(2);
  });

  it('lights both arms of a diamond from the real store state', () => {
    // The whole chain: depth grouping -> store -> canvas mapping. This is the
    // link a browser would show; everything past it is React rendering a flag.
    usePlaybackStore.getState().closePlayback();
    usePlaybackStore.getState().setTraceData(
      ['t1', 't2', 't3', 't4'],
      [
        graphNode('a', ['input'], ['t1']),
        graphNode('b', ['t1'], ['t2']),
        graphNode('c', ['t1'], ['t3']),
        graphNode('d', ['t2', 't3'], ['t4']),
      ],
    );
    usePlaybackStore.getState().setCurrentStep(1);

    const { activeNodeNames, stepNonce } = usePlaybackStore.getState();
    const canvas = applyHighlight(
      ['a', 'b', 'c', 'd'].map(canvasNode),
      activeNodeNames,
      stepNonce,
    );

    expect(highlighted(canvas)).toEqual(['b', 'c']);
    usePlaybackStore.getState().closePlayback();
  });
});

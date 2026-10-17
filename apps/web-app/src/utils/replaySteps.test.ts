import { describe, it, expect } from 'vitest';
import { buildReplaySteps, nodeDepths } from './replaySteps';
import type { OnnxNode } from '../types';

const node = (
  name: string,
  inputs: string[],
  outputs: string[],
  extra: Partial<OnnxNode> = {},
): OnnxNode => ({ name, opType: 'Op', inputs, outputs, ...extra });

/** Every output of every node is traceable — the ordinary case. */
const allOutputs = (nodes: OnnxNode[]) => nodes.flatMap((n) => n.outputs);

const names = (nodes: OnnxNode[], outputKeys = allOutputs(nodes)) =>
  buildReplaySteps(nodes, outputKeys).map((step) => step.nodeNames);

describe('nodeDepths', () => {
  it('puts a node fed only by graph inputs at depth 0', () => {
    const nodes = [node('a', ['input', 'weight'], ['t1'])];

    expect(nodeDepths(nodes).get('a')).toBe(0);
  });

  it('takes the deepest producer, not the first or the last', () => {
    const nodes = [
      node('a', ['input'], ['t1']),
      node('b', ['t1'], ['t2']),
      node('c', ['t2'], ['t3']),
      node('join', ['t1', 't3'], ['t4']),   // depth 0 and depth 2 producers
    ];

    expect(nodeDepths(nodes).get('join')).toBe(3);
  });
});

describe('buildReplaySteps', () => {
  it('gives a chain one node per step', () => {
    const nodes = [
      node('a', ['input'], ['t1']),
      node('b', ['t1'], ['t2']),
      node('c', ['t2'], ['t3']),
    ];

    expect(names(nodes)).toEqual([['a'], ['b'], ['c']]);
  });

  it('puts the two arms of a diamond in the same step', () => {
    // a -> {b, c} -> d. Neither arm depends on the other, so showing one
    // finishing before the other starts invents an order the model lacks.
    const nodes = [
      node('a', ['input'], ['t1']),
      node('b', ['t1'], ['t2']),
      node('c', ['t1'], ['t3']),
      node('d', ['t2', 't3'], ['t4']),
    ];

    expect(names(nodes)).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('does not pair arms of unequal length', () => {
    // a -> b -> d and a -> c1 -> c2 -> d: b sits with c1, not with c2.
    const nodes = [
      node('a', ['input'], ['t1']),
      node('b', ['t1'], ['t2']),
      node('c1', ['t1'], ['t3']),
      node('c2', ['t3'], ['t4']),
      node('d', ['t2', 't4'], ['t5']),
    ];

    expect(names(nodes)).toEqual([['a'], ['b', 'c1'], ['c2'], ['d']]);
  });

  it('keeps depth correct past a node the run did not return', () => {
    // 'hidden' is a real producer — issue 001 leaves some outputs unpromoted —
    // so it still pushes what follows deeper while showing nothing itself.
    const nodes = [
      node('a', ['input'], ['t1']),
      node('hidden', ['t1'], ['t2']),
      node('c', ['t2'], ['t3']),
    ];

    expect(names(nodes, ['t1', 't3'])).toEqual([['a'], ['c']]);
    expect(nodeDepths(nodes).get('c')).toBe(2);
  });

  it('drops a depth where nothing is traceable rather than showing it empty', () => {
    const nodes = [
      node('a', ['input'], ['t1']),
      node('skipped1', ['t1'], ['t2']),
      node('skipped2', ['t1'], ['t3']),
      node('d', ['t2', 't3'], ['t4']),
    ];

    const steps = buildReplaySteps(nodes, ['t1', 't4']);

    expect(steps.map((s) => s.nodeNames)).toEqual([['a'], ['d']]);
    expect(steps.map((s) => s.depth)).toEqual([0, 2]);   // depth 1 is gone
  });

  it('leaves control-flow subgraph nodes out, because nothing promotes them', () => {
    const nodes = [
      node('Loop_0', ['input'], ['looped']),
      node('Loop_0/body/Add_1', ['Loop_0/body/v'], ['Loop_0/body/out'], {
        subgraph: 'Loop_0/body',
        inspectable: false,
      }),
      node('after', ['looped'], ['t2']),
    ];

    expect(names(nodes, ['looped', 't2'])).toEqual([['Loop_0'], ['after']]);
  });

  it('returns nothing for an empty graph or a run that returned nothing', () => {
    expect(buildReplaySteps([], [])).toEqual([]);
    expect(buildReplaySteps([node('a', ['input'], ['t1'])], [])).toEqual([]);
  });
});

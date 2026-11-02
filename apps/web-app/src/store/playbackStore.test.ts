import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlaybackStore } from './playbackStore';
import type { OnnxNode } from '../types';

const node = (name: string, inputs: string[], outputs: string[]): OnnxNode =>
  ({ name, opType: 'Op', inputs, outputs });

/** a -> {b, c} -> d: one step holds two nodes, the others hold one. */
const diamond: OnnxNode[] = [
  node('a', ['input'], ['t1']),
  node('b', ['t1'], ['t2']),
  node('c', ['t1'], ['t3']),
  node('d', ['t2', 't3'], ['t4']),
];
const keys = ['t1', 't2', 't3', 't4'];

const store = () => usePlaybackStore.getState();
const active = () => [...store().activeNodeNames].sort();

describe('playbackStore — issue 020 criterion 2', () => {
  beforeEach(() => {
    usePlaybackStore.getState().closePlayback();
    usePlaybackStore.getState().setTraceData(keys, diamond);
  });

  afterEach(() => {
    usePlaybackStore.getState().closePlayback();
  });

  it('counts steps as depth levels, not nodes', () => {
    expect(store().totalSteps).toBe(3);
  });

  it('highlights every node at the step when scrubbing', () => {
    store().setCurrentStep(1);

    expect(active()).toEqual(['b', 'c']);
  });

  it('highlights every node at the step when stepping forward', () => {
    store().seekStep(1);
    expect(active()).toEqual(['a']);

    store().seekStep(1);
    expect(active()).toEqual(['b', 'c']);
  });

  it('highlights every node at the step when stepping back', () => {
    store().setCurrentStep(2);
    expect(active()).toEqual(['d']);

    store().seekStep(-1);
    expect(active()).toEqual(['b', 'c']);
  });

  it('clears the highlight before the first step', () => {
    store().setCurrentStep(1);
    store().seekStep(-1);
    store().seekStep(-1);

    expect(store().currentStep).toBe(-1);
    expect(active()).toEqual([]);
  });

  describe('during playback', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('highlights every node at each step it passes through', () => {
      store().startPlayback();
      expect(active()).toEqual(['a']);

      vi.advanceTimersByTime(500);
      expect(active()).toEqual(['b', 'c']);
    });

    it('leaves every node of the last step highlighted at the end', () => {
      store().startPlayback();
      vi.advanceTimersByTime(5000);

      expect(store().isPlaying).toBe(false);
      expect(store().currentStep).toBe(2);
      expect(active()).toEqual(['d']);
    });

    it('leaves a multi-node last step fully highlighted', () => {
      // A graph whose deepest level holds two nodes, so the end-of-playback
      // path is exercised on a step that is not a single node.
      store().setTraceData(['t1', 't2', 't3'], [
        node('a', ['input'], ['t1']),
        node('b', ['t1'], ['t2']),
        node('c', ['t1'], ['t3']),
      ]);

      store().startPlayback();
      vi.advanceTimersByTime(5000);

      expect(active()).toEqual(['b', 'c']);
    });
  });
});

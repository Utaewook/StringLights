import { describe, it, expect } from 'vitest';
import {
  MAX_BATCH_SIZE,
  MAX_RUN_BYTES,
  clampBatchSize,
  estimateRunBytes,
  largestFittingBatch,
  resolveShape,
  tensorBytes,
} from './runBudget';
import type { ModelInput, ModelOutput } from '../types';

const t = (name: string, dtype: string, shape: number[]): ModelInput =>
  ({ name, dtype, shape });

const MB = 1024 * 1024;

describe('clampBatchSize — issue 018 criterion 1', () => {
  it('clamps above the ceiling, which the max attribute does not', () => {
    expect(clampBatchSize('99999')).toBe(MAX_BATCH_SIZE);
  });

  it('clamps below 1', () => {
    expect(clampBatchSize('0')).toBe(1);
    expect(clampBatchSize('-20')).toBe(1);
  });

  it('returns 1 for input that is not a number', () => {
    // Number('') is NaN, and Math.max(1, NaN) is NaN — the old handler's bug.
    expect(clampBatchSize('')).toBe(1);
    expect(clampBatchSize('abc')).toBe(1);
    expect(clampBatchSize(NaN)).toBe(1);
    expect(clampBatchSize(Infinity)).toBe(1);
  });

  it('truncates a fractional value rather than allocating on it', () => {
    expect(clampBatchSize('3.7')).toBe(3);
  });

  it('passes a value already in range through', () => {
    expect(clampBatchSize('8')).toBe(8);
  });
});

describe('resolveShape', () => {
  it('substitutes the batch size into the leading axis only', () => {
    expect(resolveShape([-1, -1, 8], 4)).toEqual([4, 1, 8]);
  });

  it('leaves a fully static shape alone', () => {
    expect(resolveShape([2, 3, 4], 16)).toEqual([2, 3, 4]);
  });
});

describe('tensorBytes — issue 018 criterion 2', () => {
  it('uses each dtype width, not a single assumed one', () => {
    expect(tensorBytes(t('a', 'float32', [1, 128]), 1)).toBe(512);
    expect(tensorBytes(t('a', 'float64', [1, 128]), 1)).toBe(1024);
    expect(tensorBytes(t('a', 'int64', [1, 128]), 1)).toBe(1024);
    expect(tensorBytes(t('a', 'int8', [1, 128]), 1)).toBe(128);
  });

  it('scales with the batch size on a dynamic leading axis', () => {
    expect(tensorBytes(t('a', 'float32', [-1, 256]), 8)).toBe(8 * 256 * 4);
  });
});

describe('estimateRunBytes — issue 018 criterion 4', () => {
  it('sums across every input rather than checking one at a time', () => {
    // The old limit ran per input, so three of them bought three times the cap.
    const inputs = [
      t('a', 'float32', [1, 1024]),
      t('b', 'float32', [1, 1024]),
      t('c', 'float32', [1, 1024]),
    ];

    expect(estimateRunBytes(inputs, [], 1).inputBytes).toBe(3 * 1024 * 4);
  });

  it('counts the returned activations, which are the larger term', () => {
    const inputs = [t('x', 'float32', [-1, 3, 224, 224])];
    const outputs: ModelOutput[] = Array.from({ length: 14 }, (_, i) =>
      t(`act${i}`, 'float32', [-1, 64, 56, 56]),
    );

    const estimate = estimateRunBytes(inputs, outputs, 1);

    expect(estimate.outputBytes).toBeGreaterThan(estimate.inputBytes * 10);
    expect(estimate.totalBytes).toBe(estimate.inputBytes + estimate.outputBytes);
  });

  it('is within budget for a small model', () => {
    expect(estimateRunBytes([t('x', 'float32', [1, 16])], [], 1).withinBudget).toBe(true);
  });

  it('is over budget once the activations pass the limit', () => {
    const outputs = [t('big', 'float32', [-1, 1024, 1024])];   // 4MB per item

    expect(estimateRunBytes([], outputs, 200).withinBudget).toBe(false);
  });

  it('treats exactly the budget as within it', () => {
    const outputs = [t('exact', 'uint8', [MAX_RUN_BYTES])];

    const estimate = estimateRunBytes([], outputs, 1);

    expect(estimate.totalBytes).toBe(MAX_RUN_BYTES);
    expect(estimate.withinBudget).toBe(true);
  });
});

describe('largestFittingBatch — issue 018 criterion 4', () => {
  it('solves for the batch size instead of searching', () => {
    // 80MB per item against a 512MB budget: 6 fits, 7 does not.
    // 20,971,520 float32 elements = 80MB.
    const outputs = [t('act', 'float32', [-1, 20 * MB])];

    const fitting = largestFittingBatch([], outputs);

    expect(fitting).toBe(6);
    expect(estimateRunBytes([], outputs, fitting).withinBudget).toBe(true);
    expect(estimateRunBytes([], outputs, fitting + 1).withinBudget).toBe(false);
  });

  it('accounts for the fixed part of a run', () => {
    const outputs = [
      t('fixed', 'uint8', [256 * MB]),        // does not scale
      t('scaled', 'uint8', [-1, 64 * MB]),    // 64MB per item
    ];

    expect(largestFittingBatch([], outputs)).toBe(4);
  });

  it('returns 0 when even one item is over budget', () => {
    const outputs = [t('huge', 'float32', [-1, 1024, 1024, 1024])];

    expect(largestFittingBatch([], outputs)).toBe(0);
  });

  it('returns the ceiling when nothing scales with the batch size', () => {
    const outputs = [t('static', 'float32', [1, 16])];

    expect(largestFittingBatch([], outputs)).toBe(MAX_BATCH_SIZE);
  });

  it('never exceeds the batch ceiling even when the budget would allow it', () => {
    const outputs = [t('tiny', 'float32', [-1, 1])];

    expect(largestFittingBatch([], outputs)).toBe(MAX_BATCH_SIZE);
  });
});

import { describe, it, expect } from 'vitest';
import { computeStats, formatBytes, tensorByteSize } from './tensorStats';

describe('computeStats', () => {
  it('computes a real standard deviation', () => {
    // mean 5, population std 2
    const stats = computeStats(new Float32Array([2, 4, 4, 4, 5, 5, 7, 9]));

    expect(stats.mean).toBeCloseTo(5, 6);
    expect(stats.std).toBeCloseTo(2, 5);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
    expect(stats.hasNaN).toBe(false);
    expect(stats.hasInf).toBe(false);
  });

  it('divides the mean by the count it actually used, not the buffer length', () => {
    // The worker's old loop skipped NaN from the sum and still divided by 4,
    // reporting 15 instead of 20.
    const stats = computeStats(new Float32Array([10, 20, 30, NaN]));

    expect(stats.hasNaN).toBe(true);
    expect(stats.mean).toBeCloseTo(20, 6);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(30);
  });

  it('excludes +Infinity instead of letting it reach max and the sum', () => {
    const stats = computeStats(new Float32Array([1, 2, 3, Infinity]));

    expect(stats.hasInf).toBe(true);
    expect(stats.max).toBe(3);
    expect(stats.mean).toBeCloseTo(2, 6);
    expect(Number.isFinite(stats.std)).toBe(true);
  });

  it('excludes -Infinity instead of letting it reach min', () => {
    const stats = computeStats(new Float32Array([-Infinity, 5, 7, 9]));

    expect(stats.min).toBe(5);
    expect(stats.mean).toBeCloseTo(7, 6);
  });

  it('survives both infinities, which used to make the sum NaN', () => {
    const stats = computeStats(new Float32Array([-Infinity, Infinity, 4, 6]));

    expect(stats.mean).toBeCloseTo(5, 6);
    expect(stats.min).toBe(4);
    expect(stats.max).toBe(6);
  });

  it('returns zeros when every value is NaN, and still flags it', () => {
    const stats = computeStats(new Float32Array([NaN, NaN]));

    expect(stats).toMatchObject({ min: 0, max: 0, mean: 0, std: 0, hasNaN: true });
  });

  it('returns zeros for an empty buffer', () => {
    expect(computeStats(new Float32Array([]))).toMatchObject({
      min: 0, max: 0, mean: 0, std: 0, hasNaN: false, hasInf: false,
    });
  });

  it('reports std 0 for a single element', () => {
    const stats = computeStats(new Float32Array([42]));

    expect(stats.mean).toBe(42);
    expect(stats.std).toBe(0);
  });

  it('reports a genuine 0 std for constant data', () => {
    const stats = computeStats(new Float32Array([3, 3, 3, 3]));

    expect(stats.mean).toBe(3);
    expect(stats.std).toBe(0);
  });

  it('handles BigInt64Array without throwing', () => {
    const stats = computeStats(new BigInt64Array([1n, 2n, 3n, 4n]));

    expect(stats.mean).toBeCloseTo(2.5, 6);
    expect(stats.std).toBeCloseTo(Math.sqrt(1.25), 9);
  });

  it('matches an independently computed std over 1000 values', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = Math.sin(i) * 100;

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const reference = Math.sqrt(
      data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length,
    );

    expect(computeStats(data).std).toBeCloseTo(reference, 3);
  });
});

describe('formatBytes', () => {
  it('uses bytes, KB and MB at the right thresholds', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });
});

describe('tensorByteSize', () => {
  it('multiplies the element count by the dtype width', () => {
    expect(tensorByteSize([1, 128], 'float32')).toBe(512);
    expect(tensorByteSize([1, 128], 'int8')).toBe(128);
    expect(tensorByteSize([2, 3, 4], 'float64')).toBe(192);
  });

  it('treats bool as one byte, matching how the input is built', () => {
    expect(tensorByteSize([10], 'bool')).toBe(10);
  });
});

import type { TensorStats } from '../types';

/**
 * Computes min/max/mean/std/NaN/Inf statistics over a tensor's raw buffer.
 *
 * NaN and Inf are recorded as flags and then excluded from every numeric result.
 * They have to be: a single Infinity otherwise propagates through the sum and
 * makes min, max and mean meaningless, which is the opposite of what an
 * integrity check is for. `mean` divides by the count of values actually used,
 * not by the buffer length.
 *
 * Two passes rather than Welford's — variance from a known mean is the more
 * numerically stable of the two, and this runs inside the worker where it costs
 * the UI thread nothing.
 */
export function computeStats(data: ArrayLike<number | bigint>): TensorStats {
  const len = data.length;

  if (len === 0) {
    return { min: 0, max: 0, mean: 0, std: 0, hasNaN: false, hasInf: false };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCount = 0;
  let hasNaN = false;
  let hasInf = false;

  for (let i = 0; i < len; i++) {
    const raw = data[i];
    const v = typeof raw === 'bigint' ? Number(raw) : (raw as number);

    if (Number.isNaN(v)) { hasNaN = true; continue; }
    if (!Number.isFinite(v)) { hasInf = true; continue; }

    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    validCount++;
  }

  const mean = validCount > 0 ? sum / validCount : 0;

  let variance = 0;
  for (let i = 0; i < len; i++) {
    const raw = data[i];
    const v = typeof raw === 'bigint' ? Number(raw) : (raw as number);
    if (!Number.isFinite(v) || Number.isNaN(v)) continue;
    variance += (v - mean) ** 2;
  }

  const std = validCount > 1 ? Math.sqrt(variance / validCount) : 0;

  return {
    min: isFinite(min) ? min : 0,
    max: isFinite(max) ? max : 0,
    mean,
    std,
    hasNaN,
    hasInf,
  };
}

/**
 * Human-readable byte size string.
 *
 * A GB tier matters for the run budget (issue 018): the figures it refuses are
 * exactly the ones that run off the end of a MB scale, and "13083.50 MB" is a
 * number the reader has to divide in their head.
 */
export function formatBytes(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/**
 * Returns element byte size for a given dtype string.
 *
 * Exported so `runBudget.ts` sizes a run from the same table this file reports
 * tensor sizes with. A second copy would be free to drift from this one, and the
 * budget would then disagree with the figure shown next to the tensor.
 *
 * `string` is not a fixed-width dtype and falls to the default; a string tensor
 * cannot be budgeted by element count at all.
 */
export function elementSize(dtype: string): number {
  switch (dtype) {
    case 'float64':
    case 'int64':
    case 'uint64': return 8;
    case 'float32':
    case 'int32':
    case 'uint32': return 4;
    case 'float16':
    case 'int16':
    case 'uint16': return 2;
    case 'int8':
    case 'uint8':
    case 'bool': return 1;
    default: return 4;
  }
}

/** Total byte size of a tensor given shape and dtype. */
export function tensorByteSize(shape: number[], dtype: string): number {
  const numel = shape.reduce((a, b) => a * b, 1);
  return numel * elementSize(dtype);
}

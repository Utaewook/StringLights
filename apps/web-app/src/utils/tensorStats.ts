import type { TensorResult, TensorStats } from '../types';

/**
 * Computes min/max/mean/std/NaN/Inf statistics from a TensorResult.
 * Skips NaN and Inf values when computing numeric stats.
 */
export function computeStats(tensor: TensorResult): TensorStats {
  const data = tensor.data as ArrayLike<number | bigint>;
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

/** Human-readable byte size string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Returns element byte size for a given dtype string. */
function elementSize(dtype: string): number {
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

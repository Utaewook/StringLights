import type { ModelInput, ModelOutput } from '../types';
import { elementSize } from './tensorStats';

/**
 * Sizes a test run before it is started.
 *
 * The limit this replaces counted elements on the input side only, which is the
 * smaller term by a wide margin: graph surgery promotes every intermediate
 * tensor to a graph output (ADR 0001), so one run returns every activation in
 * the model. A 940KB convolutional model returns 25MB of activations at batch 1
 * and 799MB at batch 32, while its input stays under 20MB. See
 * docs/issues/018-inference-memory-is-unbounded.md.
 */

/**
 * Total bytes of inputs plus returned activations that one run may use.
 *
 * Each tensor exists about three times over — built on the main thread, copied
 * into the worker, copied again into onnxruntime's WASM heap — so 512MB of
 * tensors is roughly 1.5GB of real footprint, which is near what a tab carries
 * without being killed.
 *
 * Fixed rather than derived from `navigator.deviceMemory`. A device-derived
 * budget would make the same model at the same batch size succeed for one
 * person and fail for another, and an irreproducible report costs a debugging
 * tool more than the batches a fixed number turns away.
 */
export const MAX_RUN_BYTES = 512 * 1024 * 1024;

/** Upper bound on the batch control. Shared with its `max` attribute so the
 *  two cannot drift; the attribute alone does not bind typed input. */
export const MAX_BATCH_SIZE = 512;

/**
 * Brings a batch-size input back inside its bounds.
 *
 * The control's `max` attribute does not bind typed or pasted values, and
 * `Number('')` is `NaN`, which `Math.max(1, NaN)` returns unchanged — so the
 * previous handler clamped neither end in the cases that mattered. Lives here
 * rather than in the panel so it can be tested. See docs/issues/018.
 */
export function clampBatchSize(raw: string | number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

/**
 * Resolves dynamic axes to concrete lengths.
 *
 * Only the leading axis is treated as a batch axis, because that is the only
 * one convention lets us guess. Substituting the batch size into a sequence or
 * spatial axis fabricates a shape the model was never exported for, and does it
 * silently. Those axes get 1, the one length that is always valid — see
 * docs/issues/017-non-batch-dynamic-axes-are-guessed.md.
 *
 * Both the allocator and the estimate call this. Two resolutions would be free
 * to disagree, and a budget that measures a different shape than the one
 * allocated is worse than no budget.
 */
export function resolveShape(shape: number[], batchSize: number): number[] {
  return shape.map((dim, axis) => {
    if (dim !== -1) return dim;
    return axis === 0 ? batchSize : 1;
  });
}

/** Element count for a tensor at a given batch size. */
export function resolvedElementCount(shape: number[], batchSize: number): number {
  return resolveShape(shape, batchSize).reduce((total, dim) => total * dim, 1);
}

/** Byte size of one tensor at a given batch size. */
export function tensorBytes(tensor: ModelInput | ModelOutput, batchSize: number): number {
  return resolvedElementCount(tensor.shape, batchSize) * elementSize(tensor.dtype);
}

export interface RunEstimate {
  inputBytes: number;
  outputBytes: number;
  totalBytes: number;
  withinBudget: boolean;
}

/** What one run at this batch size would allocate, inputs and outputs together. */
export function estimateRunBytes(
  inputs: readonly ModelInput[],
  outputs: readonly ModelOutput[],
  batchSize: number,
): RunEstimate {
  const sum = (tensors: readonly (ModelInput | ModelOutput)[]) =>
    tensors.reduce((total, tensor) => total + tensorBytes(tensor, batchSize), 0);

  const inputBytes = sum(inputs);
  const outputBytes = sum(outputs);
  const totalBytes = inputBytes + outputBytes;

  return { inputBytes, outputBytes, totalBytes, withinBudget: totalBytes <= MAX_RUN_BYTES };
}

/**
 * The largest batch size that fits the budget, or 0 when even one item does not.
 *
 * Total bytes are affine in the batch size — each tensor contributes
 * `width x (product of its non-batch dims) x (batch, if it has a batch axis)` —
 * so this is solved, not searched: measure at batch 1 and batch 2, and the
 * difference is the per-item cost.
 */
export function largestFittingBatch(
  inputs: readonly ModelInput[],
  outputs: readonly ModelOutput[],
): number {
  const atOne = estimateRunBytes(inputs, outputs, 1).totalBytes;
  const atTwo = estimateRunBytes(inputs, outputs, 2).totalBytes;
  const perItem = atTwo - atOne;

  // Nothing scales with the batch size: either it fits at any size, or never.
  if (perItem <= 0) return atOne <= MAX_RUN_BYTES ? MAX_BATCH_SIZE : 0;

  const fixed = atOne - perItem;
  const fitting = Math.floor((MAX_RUN_BYTES - fixed) / perItem);

  return Math.max(0, Math.min(MAX_BATCH_SIZE, fitting));
}

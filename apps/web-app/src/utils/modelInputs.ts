import type { ModelInput } from '../types';
import { MAX_RUN_BYTES, resolveShape, tensorBytes } from './runBudget';

/**
 * Builds the tensors fed to a model for a test run.
 *
 * The rule this module exists to enforce: the TypedArray must match the dtype
 * string that travels with it. onnxruntime reads the string and reinterprets
 * the buffer, so an Int32Array labelled `int16` is not a lossy conversion — it
 * is a hard failure at session run, surfaced to the user as a generic
 * "Inference failed".
 */

export type InputTypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array;

export interface BuiltInput {
  data: InputTypedArray;
  shape: number[];
  type: string;
}

/** Thrown for a model this app cannot generate inputs for. Shown to the user. */
export class UnsupportedInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedInputError';
  }
}

/**
 * One entry per dtype we can honestly construct.
 *
 * `bool` is deliberately a Uint8Array — that is the representation onnxruntime
 * expects, and it travels with the `bool` type string, so the pairing is
 * correct rather than a mismatch.
 *
 * Absent on purpose: `float16`, which would need hand-built half-precision bit
 * patterns that random values cannot safely produce, and `string`, which is not
 * a numeric tensor at all. Both are refused rather than approximated.
 */
const ARRAY_BY_DTYPE: Record<string, (length: number) => InputTypedArray> = {
  float32: (n) => new Float32Array(n),
  float64: (n) => new Float64Array(n),
  int8: (n) => new Int8Array(n),
  uint8: (n) => new Uint8Array(n),
  int16: (n) => new Int16Array(n),
  uint16: (n) => new Uint16Array(n),
  int32: (n) => new Int32Array(n),
  uint32: (n) => new Uint32Array(n),
  int64: (n) => new BigInt64Array(n),
  uint64: (n) => new BigUint64Array(n),
  bool: (n) => new Uint8Array(n),
};

const RANDOMISABLE_DTYPES = new Set(['float32', 'float64']);

export const SUPPORTED_INPUT_DTYPES = Object.keys(ARRAY_BY_DTYPE);

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export function buildModelInputs(
  inputs: ModelInput[],
  mode: 'zeros' | 'random',
  batchSize: number,
): Record<string, BuiltInput> {
  const built: Record<string, BuiltInput> = {};
  let allocatedBytes = 0;

  for (const input of inputs) {
    const createArray = ARRAY_BY_DTYPE[input.dtype];
    if (!createArray) {
      throw new UnsupportedInputError(
        `Input "${input.name}" has dtype "${input.dtype}", which this app cannot ` +
          `generate test inputs for. Supported: ${SUPPORTED_INPUT_DTYPES.join(', ')}.`,
      );
    }

    const shape = resolveShape(input.shape, batchSize);
    const elements = shape.reduce((total, dim) => total * dim, 1);

    if (!Number.isSafeInteger(elements) || elements <= 0) {
      throw new UnsupportedInputError(
        `Input "${input.name}" resolved to the shape [${shape.join(', ')}], which ` +
          `has no usable size.`,
      );
    }
    // Bytes, summed across every input, rather than elements on one of them.
    // The old check counted elements, so an int64 input bought twice the bytes a
    // float32 one did, and it ran per input, so a model with three of them could
    // ask for three times the limit. See docs/issues/018.
    allocatedBytes += tensorBytes(input, batchSize);
    if (allocatedBytes > MAX_RUN_BYTES) {
      throw new UnsupportedInputError(
        `The inputs for this model need ${formatMegabytes(allocatedBytes)} at batch ` +
          `size ${batchSize}, above the ${formatMegabytes(MAX_RUN_BYTES)} budget for a ` +
          `run — try a smaller batch size.`,
      );
    }

    const data = createArray(elements);

    // Integer inputs stay zero even in random mode. They are usually indices —
    // token ids, class labels — and a random value out of range crashes an
    // embedding lookup rather than producing an interesting activation.
    if (mode === 'random' && RANDOMISABLE_DTYPES.has(input.dtype)) {
      const floats = data as Float32Array | Float64Array;
      for (let i = 0; i < elements; i++) {
        floats[i] = Math.random();
      }
    }

    built[input.name] = { data, shape, type: input.dtype };
  }

  return built;
}

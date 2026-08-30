import type { ModelInput } from '../types';

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

/** ~256MB as float32. Past this the tab dies before onnxruntime sees anything. */
const MAX_ELEMENTS = 64 * 1024 * 1024;

export const SUPPORTED_INPUT_DTYPES = Object.keys(ARRAY_BY_DTYPE);

/**
 * Resolves dynamic axes to concrete lengths.
 *
 * Only the leading axis is treated as a batch axis, because that is the only
 * one convention lets us guess. Substituting the batch size into a sequence or
 * spatial axis — which is what this used to do for every dynamic dimension —
 * fabricates a shape the model was never exported for, and does it silently.
 * Those axes get 1, the one length that is always valid.
 */
function resolveShape(input: ModelInput, batchSize: number): number[] {
  return input.shape.map((dim, axis) => {
    if (dim !== -1) return dim;
    return axis === 0 ? batchSize : 1;
  });
}

export function buildModelInputs(
  inputs: ModelInput[],
  mode: 'zeros' | 'random',
  batchSize: number,
): Record<string, BuiltInput> {
  const built: Record<string, BuiltInput> = {};

  for (const input of inputs) {
    const createArray = ARRAY_BY_DTYPE[input.dtype];
    if (!createArray) {
      throw new UnsupportedInputError(
        `Input "${input.name}" has dtype "${input.dtype}", which this app cannot ` +
          `generate test inputs for. Supported: ${SUPPORTED_INPUT_DTYPES.join(', ')}.`,
      );
    }

    const shape = resolveShape(input, batchSize);
    const elements = shape.reduce((total, dim) => total * dim, 1);

    if (!Number.isSafeInteger(elements) || elements <= 0) {
      throw new UnsupportedInputError(
        `Input "${input.name}" resolved to the shape [${shape.join(', ')}], which ` +
          `has no usable size.`,
      );
    }
    if (elements > MAX_ELEMENTS) {
      throw new UnsupportedInputError(
        `Input "${input.name}" would need ${elements.toLocaleString()} elements at ` +
          `batch size ${batchSize}. That is more than this app will allocate in the ` +
          `browser — try a smaller batch size.`,
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

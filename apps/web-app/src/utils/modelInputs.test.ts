import { describe, it, expect } from 'vitest';
import {
  buildModelInputs,
  UnsupportedInputError,
  SUPPORTED_INPUT_DTYPES,
} from './modelInputs';
import type { ModelInput } from '../types';

const input = (dtype: string, shape: number[] = [2, 2]): ModelInput =>
  ({ name: 'x', dtype, shape }) as ModelInput;

describe('buildModelInputs — dtype pairing', () => {
  // The defect this module exists to prevent: onnxruntime reinterprets the
  // buffer according to the type string, so a mismatch is a hard failure.
  const expected: [string, new (n: number) => ArrayBufferView][] = [
    ['float32', Float32Array],
    ['float64', Float64Array],
    ['int8', Int8Array],
    ['uint8', Uint8Array],
    ['int16', Int16Array],
    ['uint16', Uint16Array],
    ['int32', Int32Array],
    ['uint32', Uint32Array],
    ['int64', BigInt64Array],
    ['uint64', BigUint64Array],
    ['bool', Uint8Array],
  ];

  it.each(expected)('builds %s as the array onnxruntime requires', (dtype, Ctor) => {
    const built = buildModelInputs([input(dtype)], 'zeros', 1);

    expect(built.x.data).toBeInstanceOf(Ctor);
    expect(built.x.type).toBe(dtype);
  });

  it('covers every dtype the module advertises', () => {
    expect(new Set(SUPPORTED_INPUT_DTYPES)).toEqual(new Set(expected.map(([d]) => d)));
  });

  it('gives int16 a two-byte element, not four', () => {
    const built = buildModelInputs([input('int16', [4])], 'zeros', 1);

    expect(built.x.data.byteLength).toBe(8);
  });
});

describe('buildModelInputs — refusals', () => {
  it.each(['float16', 'string', 'bfloat16', 'complex64'])(
    'refuses %s by name rather than approximating it',
    (dtype) => {
      expect(() => buildModelInputs([input(dtype)], 'zeros', 1)).toThrow(
        UnsupportedInputError,
      );
      expect(() => buildModelInputs([input(dtype)], 'zeros', 1)).toThrow(dtype);
    },
  );

  it('names the offending input so the user knows which one', () => {
    const bad = { name: 'attention_mask', dtype: 'float16', shape: [1, 8] } as ModelInput;

    expect(() => buildModelInputs([bad], 'zeros', 1)).toThrow('attention_mask');
  });

  it('refuses a shape too large to allocate instead of crashing the tab', () => {
    expect(() =>
      buildModelInputs([input('float32', [1, 1024, 1024, 1024])], 'zeros', 1),
    ).toThrow(UnsupportedInputError);
  });

  it('refuses a shape with no usable size', () => {
    expect(() => buildModelInputs([input('float32', [0, 4])], 'zeros', 1)).toThrow(
      UnsupportedInputError,
    );
  });
});

describe('buildModelInputs — dynamic axes', () => {
  it('substitutes the batch size into the leading axis only', () => {
    // Issue 017: every -1 used to become the batch size, so a transformer at
    // batch 4 silently got a sequence length of 4.
    const built = buildModelInputs([input('float32', [-1, -1, 8])], 'zeros', 4);

    expect(built.x.shape).toEqual([4, 1, 8]);
  });

  it('leaves static dimensions alone', () => {
    const built = buildModelInputs([input('float32', [-1, 2])], 'zeros', 3);

    expect(built.x.shape).toEqual([3, 2]);
    expect(built.x.data.length).toBe(6);
  });

  it('does not treat a non-leading -1 as a batch axis even at batch size 1', () => {
    const built = buildModelInputs([input('float32', [1, -1])], 'zeros', 1);

    expect(built.x.shape).toEqual([1, 1]);
  });
});

describe('buildModelInputs — random mode', () => {
  it('fills float tensors with values in [0, 1)', () => {
    const built = buildModelInputs([input('float32', [64])], 'random', 1);
    const data = built.x.data as Float32Array;

    expect(data.some((v) => v !== 0)).toBe(true);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...data)).toBeLessThan(1);
  });

  it('leaves integer tensors at zero — they are usually indices', () => {
    const built = buildModelInputs([input('int32', [64])], 'random', 1);
    const data = built.x.data as Int32Array;

    expect(data.every((v) => v === 0)).toBe(true);
  });

  it('leaves bool tensors at zero', () => {
    const built = buildModelInputs([input('bool', [64])], 'random', 1);

    expect((built.x.data as Uint8Array).every((v) => v === 0)).toBe(true);
  });
});

describe('buildModelInputs — multiple inputs', () => {
  it('keys every input by name', () => {
    const built = buildModelInputs(
      [
        { name: 'ids', dtype: 'int64', shape: [1, 4] } as ModelInput,
        { name: 'mask', dtype: 'bool', shape: [1, 4] } as ModelInput,
      ],
      'zeros',
      1,
    );

    expect(Object.keys(built).sort()).toEqual(['ids', 'mask']);
    expect(built.ids.data).toBeInstanceOf(BigInt64Array);
    expect(built.mask.data).toBeInstanceOf(Uint8Array);
  });

  it('refuses the whole request if any one input is unsupported', () => {
    const inputs = [
      { name: 'ok', dtype: 'float32', shape: [1] } as ModelInput,
      { name: 'bad', dtype: 'float16', shape: [1] } as ModelInput,
    ];

    expect(() => buildModelInputs(inputs, 'zeros', 1)).toThrow('bad');
  });
});

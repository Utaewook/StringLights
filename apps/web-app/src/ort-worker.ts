import * as ort from 'onnxruntime-web';
import type { TensorStats } from './types';

ort.env.wasm.wasmPaths = import.meta.env.DEV 
  ? '/node_modules/onnxruntime-web/dist/' 
  : '/';

let currentSession: ort.InferenceSession | null = null;

type TypedArray = Exclude<ort.Tensor.DataType, string[]>;

function calculateStats(data: TypedArray): TensorStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let hasNaN = false;
  let hasInf = false;
  const len = data.length;

  for (let i = 0; i < len; i++) {
    const val = Number(data[i]);
    if (Number.isNaN(val)) {
      hasNaN = true;
      continue;
    }
    if (!Number.isFinite(val)) {
      hasInf = true;
    }
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }
  
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  return {
    min,
    max,
    mean: len > 0 ? sum / len : 0,
    std: 0, // Skipping std for performance
    hasNaN,
    hasInf,
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    // ─── LOAD ─────────────────────────────────────────────────────────────
    case 'LOAD': {
      const { modelBytes } = payload as { modelBytes: Uint8Array };
      try {
        // Release existing session to prevent memory leaks
        if (currentSession) {
          await currentSession.release();
          currentSession = null;
        }

        // Attempt WebGPU first
        try {
          currentSession = await ort.InferenceSession.create(modelBytes, {
            executionProviders: ['webgpu'],
          });
          self.postMessage({ type: 'LOAD_SUCCESS', provider: 'webgpu' });
        } catch (gpuError) {
          console.warn('WebGPU failed in worker, falling back to WASM:', gpuError);

          currentSession = await ort.InferenceSession.create(modelBytes, {
            executionProviders: ['wasm'],
          });
          self.postMessage({ type: 'LOAD_SUCCESS', provider: 'wasm' });
        }
      } catch (error) {
        const err = error as Error;
        console.error('Session load failed:', err);
        self.postMessage({ type: 'ERROR', detail: `Model load failed: ${err.message ?? String(err)}` });
      }
      break;
    }

    // ─── RUN ──────────────────────────────────────────────────────────────
    case 'RUN': {
      if (!currentSession) {
        self.postMessage({ type: 'ERROR', detail: 'Inference session is not loaded.' });
        return;
      }

      const { inputs } = payload as {
        inputs: Record<string, { data: TypedArray; shape: number[]; type: string }>;
      };

      try {
        // Build ort.Tensor objects from raw typed arrays
        const ortInputs: Record<string, ort.Tensor> = {};
        for (const key of Object.keys(inputs)) {
          const { data, shape, type: tensorType } = inputs[key];
          ortInputs[key] = new ort.Tensor(tensorType as ort.Tensor.Type, data, shape);
        }

        // Run inference
        const rawOutputs = await currentSession.run(ortInputs);

        // Serialize outputs and compute stats
        const serializableOutputs: Record<string, { data: TypedArray; shape: number[]; type: string }> = {};
        const stats: Record<string, TensorStats> = {};

        for (const key of Object.keys(rawOutputs)) {
          const tensor = rawOutputs[key];

          if (Array.isArray(tensor.data)) {
            throw new Error(`String tensors are not supported for visualization: ${key}`);
          }

          serializableOutputs[key] = {
            data:  tensor.data,
            shape: [...tensor.dims],
            type:  tensor.type,
          };
          stats[key] = calculateStats(tensor.data);
          if (tensor && typeof (tensor as { dispose?: () => void }).dispose === 'function') {
            (tensor as { dispose: () => void }).dispose();
          }
        }

        for (const key of Object.keys(ortInputs)) {
          const t = ortInputs[key];
          if (t && typeof (t as { dispose?: () => void }).dispose === 'function') {
            (t as { dispose: () => void }).dispose();
          }
        }

        self.postMessage({ type: 'RUN_SUCCESS', outputs: serializableOutputs, stats });
      } catch (error) {
        const err = error as Error;
        console.error('Inference run failed:', err);
        self.postMessage({ type: 'ERROR', detail: `Inference failed: ${err.message ?? String(err)}` });
      }
      break;
    }

    default:
      console.warn('Unknown worker message type:', type);
  }
};

import * as ort from 'onnxruntime-web';

// Point to WASM binaries in the public directory
ort.env.wasm.wasmPaths = '/';

let currentSession: ort.InferenceSession | null = null;

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
      } catch (error: any) {
        console.error('Session load failed:', error);
        self.postMessage({ type: 'ERROR', detail: `Model load failed: ${error.message ?? error}` });
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
        inputs: Record<string, { data: any; shape: number[]; type: string }>;
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

        // Serialize outputs to plain objects (ort.Tensor is not structured-clonable)
        const serializableOutputs: Record<string, { data: any; shape: number[]; type: string }> = {};
        for (const key of Object.keys(rawOutputs)) {
          const tensor = rawOutputs[key];
          serializableOutputs[key] = {
            data:  tensor.data,
            shape: [...tensor.dims],
            type:  tensor.type,
          };
          if (typeof (tensor as any).dispose === 'function') (tensor as any).dispose();
        }

        // Clean up input tensors
        for (const key of Object.keys(ortInputs)) {
          const t = ortInputs[key];
          if (typeof (t as any).dispose === 'function') (t as any).dispose();
        }

        self.postMessage({ type: 'RUN_SUCCESS', outputs: serializableOutputs });
      } catch (error: any) {
        console.error('Inference run failed:', error);
        self.postMessage({ type: 'ERROR', detail: `Inference failed: ${error.message ?? error}` });
      }
      break;
    }

    default:
      console.warn('Unknown worker message type:', type);
  }
};

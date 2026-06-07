import * as ort from 'onnxruntime-web';

// Configure local WASM paths (points to the public directory served at root)
ort.env.wasm.wasmPaths = '/';

let currentSession: ort.InferenceSession | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'LOAD': {
      const { modelBytes } = payload;
      try {
        // 1. Release existing session if any
        if (currentSession) {
          await currentSession.release();
          currentSession = null;
        }

        // 2. Try loading session with WebGPU
        try {
          currentSession = await ort.InferenceSession.create(modelBytes, {
            executionProviders: ['webgpu'],
          });
          self.postMessage({ type: 'LOAD_SUCCESS', provider: 'webgpu' });
        } catch (gpuError) {
          console.warn("WebGPU initialization failed in worker, falling back to WASM:", gpuError);
          
          // 3. Fallback to WASM
          currentSession = await ort.InferenceSession.create(modelBytes, {
            executionProviders: ['wasm'],
          });
          self.postMessage({ type: 'LOAD_SUCCESS', provider: 'wasm' });
        }
      } catch (error: any) {
        console.error("Failed to load ONNX session in worker:", error);
        self.postMessage({ type: 'ERROR', detail: `Model load failed: ${error.message || error}` });
      }
      break;
    }

    case 'RUN': {
      if (!currentSession) {
        self.postMessage({ type: 'ERROR', detail: "Inference session is not loaded." });
        return;
      }

      const { inputs } = payload; // inputs should be Map of node name to raw Float32Array and shape

      try {
        // Reconstruct ort.Tensor from raw arrays sent from the main thread
        const ortInputs: { [key: string]: ort.Tensor } = {};
        for (const key of Object.keys(inputs)) {
          const { data, shape, type: tensorType } = inputs[key];
          ortInputs[key] = new ort.Tensor(tensorType, data, shape);
        }

        // Run inference
        const rawOutputs = await currentSession.run(ortInputs);

        // Convert outputs to raw buffers to send back (ort.Tensor objects cannot be structured-cloned easily across worker boundary)
        const serializableOutputs: { [key: string]: { data: any, shape: number[], type: string } } = {};
        for (const key of Object.keys(rawOutputs)) {
          const tensor = rawOutputs[key];
          serializableOutputs[key] = {
            data: tensor.data,
            shape: [...tensor.dims],
            type: tensor.type
          };
          
          // Dispose tensors if supported to prevent memory leaks
          if (typeof (tensor as any).dispose === 'function') {
            (tensor as any).dispose();
          }
        }

        // Clean up input tensors
        for (const key of Object.keys(ortInputs)) {
          const tensor = ortInputs[key];
          if (typeof (tensor as any).dispose === 'function') {
            (tensor as any).dispose();
          }
        }

        self.postMessage({ type: 'RUN_SUCCESS', outputs: serializableOutputs });

      } catch (error: any) {
        console.error("Inference run failed in worker:", error);
        self.postMessage({ type: 'ERROR', detail: `Inference failed: ${error.message || error}` });
      }
      break;
    }

    default:
      console.warn("Unknown message type in worker:", type);
  }
};

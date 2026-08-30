import React, { createContext, useContext, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { useModelStore }   from '../store/modelStore';
import { useUIStore }      from '../store/uiStore';
import { usePlaybackStore } from '../store/playbackStore';
import type { ModelMeta }  from '../types';

type TypedArray =
  | Float32Array
  | Int32Array
  | Uint8Array
  | BigInt64Array
  | Float64Array
  | Int16Array
  | Int8Array;

// A surgery request queues behind the backend's Semaphore(1) and is bounded
// there at 90s, with nginx giving up at 120s. Waiting past that is waiting for
// nothing, and without this the UI has no way back from a request that never
// returns.
const SURGERY_REQUEST_TIMEOUT_MS = 150_000;

// ─── Context API ─────────────────────────────────────────────────────────────

interface WorkerContextType {
  handleModelUpload:  (files: File[]) => Promise<void>;
  handleRunInference: (mode: 'zeros' | 'random', batchSize: number) => void;
}

const WorkerContext = createContext<WorkerContextType>({
  handleModelUpload:   async () => {},
  handleRunInference:  () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useWorker = () => useContext(WorkerContext);

// ─── Provider ────────────────────────────────────────────────────────────────

export function WorkerProvider({ children }: { children: React.ReactNode }) {
  const workerRef = useRef<Worker | null>(null);

  // Worker lifecycle — create once on mount, terminate on unmount
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../ort-worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Every path out of a stuck state runs through here. Without it the two
    // failures that do not arrive as a postMessage — the worker failing to load
    // its module, and a structured-clone failure on the way back — leave the UI
    // spinning forever with no error and no recovery short of a reload.
    const failWorker = (detail: string) => {
      const ui = useUIStore.getState();
      ui.setErrorMsg(detail);
      ui.setModelLoading(false);
      ui.setInferenceRunning(false);
    };

    workerRef.current.onerror = (event: ErrorEvent) => {
      // Without preventDefault the same failure is also reported to the console
      // as an uncaught error, which reads like a second, unrelated problem.
      event.preventDefault();
      failWorker(
        `The inference worker stopped: ${event.message || 'it failed to start'}. ` +
          `Reload the page and try again.`,
      );
    };

    workerRef.current.onmessageerror = () => {
      failWorker(
        'The inference worker returned data the page could not read. The model ' +
          'may produce tensors this app cannot transfer.',
      );
    };

    workerRef.current.onmessage = (e: MessageEvent) => {
      const { type, provider, outputs, stats, detail } = e.data;

      // Access stores directly (Zustand .getState() is safe outside React)
      const ui       = useUIStore.getState();
      const model    = useModelStore.getState();
      const playback = usePlaybackStore.getState();

      switch (type) {
        case 'LOAD_SUCCESS':
          ui.setEngineProvider(provider);
          ui.setModelLoading(false);
          ui.setErrorMsg(null);
          break;

        case 'RUN_SUCCESS':
          model.setInferenceOutputs(outputs, stats || {});
          ui.setInferenceRunning(false);
          ui.setErrorMsg(null);
          if (model.modelMeta) {
            playback.setTraceData(Object.keys(outputs), model.modelMeta.nodes);
          }
          ui.addToast('Inference complete', 'success');
          break;

        case 'ERROR':
          ui.setErrorMsg(detail ?? 'Worker error');
          ui.setModelLoading(false);
          ui.setInferenceRunning(false);
          break;
      }
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // ─── Upload handler (multi-file) ─────────────────────────────────────────

  const handleModelUpload = async (files: File[]) => {
    const ui      = useUIStore.getState();
    const model   = useModelStore.getState();
    const playback = usePlaybackStore.getState();

    // Basic guard: must have exactly one .onnx file
    const onnxFiles = files.filter(f => f.name.toLowerCase().endsWith('.onnx'));
    if (onnxFiles.length === 0) {
      ui.setErrorMsg('No .onnx file found in the selection.');
      return;
    }

    // Combined size guard (50MB)
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      ui.setErrorMsg('Total file size exceeds the 50MB limit.');
      return;
    }

    ui.setModelLoading(true);
    ui.setErrorMsg(null);
    model.reset();
    playback.closePlayback();

    try {
      // A: Package all selected files into a single ZIP
      const zip = new JSZip();
      files.forEach(f => zip.file(f.name, f));
      const zippedBlob = await zip.generateAsync({ type: 'blob' });

      // B: Send to surgery endpoint
      const formData = new FormData();
      formData.append('file', zippedBlob, 'model.zip');
      formData.append('perform_surgery', 'true');

      const deadline = new AbortController();
      const deadlineTimer = setTimeout(
        () => deadline.abort(),
        SURGERY_REQUEST_TIMEOUT_MS,
      );

      let response: Response;
      try {
        response = await fetch('/api/surgery', {
          method: 'POST',
          body: formData,
          signal: deadline.signal,
        });
      } catch (err) {
        if (deadline.signal.aborted) {
          throw new Error(
            'The server did not answer within ' +
              `${SURGERY_REQUEST_TIMEOUT_MS / 1000}s. It may be busy with another ` +
              'model — try again in a moment.',
            { cause: err },
          );
        }
        throw err;
      } finally {
        clearTimeout(deadlineTimer);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Graph surgery failed' }));
        throw new Error(errData.detail ?? 'Surgery request failed');
      }

      // C: Unzip response
      const responseBlob = await response.blob();
      const responseZip  = await JSZip.loadAsync(responseBlob);

      // Parse meta.json if present
      const metaEntry = responseZip.files['meta.json'];
      if (metaEntry) {
        const metaStr  = await metaEntry.async('string');
        const meta: ModelMeta = JSON.parse(metaStr);
        model.setModelMeta(meta);
      }

      // Find modified .onnx in response
      const onnxEntry = Object.values(responseZip.files).find(
        (f) => !f.dir && f.name.toLowerCase().endsWith('.onnx')
      );
      if (!onnxEntry) throw new Error('No ONNX file found in the response ZIP.');

      const modelBytes = await onnxEntry.async('uint8array');
      model.setLoadedModelBytes(modelBytes);

      // D: Load in Web Worker. A missing worker used to be logged and then
      // ignored, which left the UI loading forever with nothing on screen.
      if (!workerRef.current) {
        throw new Error(
          'The inference worker is not available. Reload the page and try again.',
        );
      }
      workerRef.current.postMessage({ type: 'LOAD', payload: { modelBytes } });

    } catch (err) {
      const error = err as Error;
      useUIStore.getState().setErrorMsg(error.message ?? 'An error occurred during upload.');
      useUIStore.getState().setModelLoading(false);
    }
  };

  // ─── Run Inference handler ───────────────────────────────────────────────

  const handleRunInference = (mode: 'zeros' | 'random', batchSize: number) => {
    const meta = useModelStore.getState().modelMeta;
    if (!workerRef.current || !meta) return;

    useUIStore.getState().setInferenceRunning(true);
    useUIStore.getState().setErrorMsg(null);
    useUIStore.getState().addToast('Inference started', 'info');

    const inputs: Record<string, { data: TypedArray; shape: number[]; type: string }> = {};

    for (const inp of meta.inputs) {
      const shape = inp.shape.map((d) => (d === -1 ? batchSize : d));
      const size  = shape.reduce((a, b) => a * b, 1);

      let data: TypedArray;
      switch (inp.dtype) {
        case 'int64':
          data = new BigInt64Array(size);
          break;
        case 'int32':
        case 'int16':
        case 'int8':
          data = new Int32Array(size);
          break;
        case 'uint8':
          data = new Uint8Array(size);
          break;
        case 'float64': {
          data = new Float64Array(size);
          if (mode === 'random') for (let i = 0; i < size; i++) data[i] = Math.random();
          break;
        }
        default: {   // float32
          data = new Float32Array(size);
          if (mode === 'random') for (let i = 0; i < size; i++) data[i] = Math.random();
        }
      }

      inputs[inp.name] = { data, shape, type: inp.dtype };
    }

    workerRef.current.postMessage({ type: 'RUN', payload: { inputs } });
  };

  return (
    <WorkerContext.Provider value={{ handleModelUpload, handleRunInference }}>
      {children}
    </WorkerContext.Provider>
  );
}

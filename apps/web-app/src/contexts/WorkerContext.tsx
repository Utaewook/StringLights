import React, { createContext, useContext, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { useModelStore } from '../store/modelStore';
import { useUIStore }    from '../store/uiStore';
import { usePlaybackStore } from '../store/playbackStore';
import type { ModelMeta } from '../types';

// ─── Context API ─────────────────────────────────────────────────────────────

interface WorkerContextType {
  handleModelUpload: (file: File) => Promise<void>;
  handleRunInference: (mode: 'zeros' | 'random', batchSize: number) => void;
}

const WorkerContext = createContext<WorkerContextType>({
  handleModelUpload:   async () => {},
  handleRunInference:  () => {},
});

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

    workerRef.current.onmessage = (e: MessageEvent) => {
      const { type, provider, outputs, detail } = e.data;

      // Access stores directly (Zustand .getState() is safe outside React)
      const ui      = useUIStore.getState();
      const model   = useModelStore.getState();
      const playback = usePlaybackStore.getState();

      switch (type) {
        case 'LOAD_SUCCESS':
          ui.setEngineProvider(provider);
          ui.setModelLoading(false);
          ui.setErrorMsg(null);
          break;

        case 'RUN_SUCCESS':
          model.setInferenceOutputs(outputs);
          ui.setInferenceRunning(false);
          ui.setErrorMsg(null);
          // Trigger step-based playback from inference outputs
          if (model.modelMeta) {
            playback.setTraceData(Object.keys(outputs), model.modelMeta.nodes);
          }
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

  // ─── Upload handler ─────────────────────────────────────────────────────

  const handleModelUpload = async (file: File) => {
    if (!file.name.endsWith('.onnx')) {
      useUIStore.getState().setErrorMsg('유효한 .onnx 파일을 업로드해 주세요.');
      return;
    }

    const ui      = useUIStore.getState();
    const model   = useModelStore.getState();
    const playback = usePlaybackStore.getState();

    ui.setModelLoading(true);
    ui.setErrorMsg(null);
    model.reset();
    playback.closePlayback();

    try {
      // A: Zip the ONNX file (reduces bandwidth, consistent with backend expectation)
      const zip = new JSZip();
      zip.file(file.name, file);
      const zippedBlob = await zip.generateAsync({ type: 'blob' });

      // B: Send to surgery endpoint
      const formData = new FormData();
      formData.append('file', zippedBlob, 'model.zip');
      formData.append('perform_surgery', 'true');

      const response = await fetch('/api/surgery', { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Graph Surgery 실패' }));
        throw new Error(errData.detail ?? 'Surgery 요청 실패');
      }

      // C: Unzip response
      const responseBlob = await response.blob();
      const responseZip  = await JSZip.loadAsync(responseBlob);

      // Parse meta.json if present
      const metaEntry = responseZip.files['meta.json'];
      if (metaEntry) {
        const metaStr = await metaEntry.async('string');
        const meta: ModelMeta = JSON.parse(metaStr);
        model.setModelMeta(meta);
      }

      // Find modified .onnx
      const onnxEntry = Object.values(responseZip.files).find(
        (f) => !f.dir && f.name.toLowerCase().endsWith('.onnx')
      );
      if (!onnxEntry) throw new Error('응답 ZIP에서 ONNX 파일을 찾을 수 없습니다.');

      const modelBytes = await onnxEntry.async('uint8array');
      model.setLoadedModelBytes(modelBytes);

      // D: Load in Web Worker
      workerRef.current?.postMessage({ type: 'LOAD', payload: { modelBytes } });

    } catch (err: any) {
      useUIStore.getState().setErrorMsg(err.message ?? '업로드 중 오류 발생');
      useUIStore.getState().setModelLoading(false);
    }
  };

  // ─── Run Inference handler ───────────────────────────────────────────────

  const handleRunInference = (mode: 'zeros' | 'random', batchSize: number) => {
    const meta = useModelStore.getState().modelMeta;
    if (!workerRef.current || !meta) return;

    useUIStore.getState().setInferenceRunning(true);
    useUIStore.getState().setErrorMsg(null);

    const inputs: Record<string, { data: any; shape: number[]; type: string }> = {};

    for (const inp of meta.inputs) {
      // Replace dynamic dims (-1) with the user-specified batchSize
      const shape = inp.shape.map((d) => (d === -1 ? batchSize : d));
      const size  = shape.reduce((a, b) => a * b, 1);

      let data: any;
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
        default: {  // float32
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

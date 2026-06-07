import { create } from 'zustand';
import type { ModelMeta, OnnxNode, InferenceOutputs } from '../types';

interface ModelState {
  loadedModelBytes: Uint8Array | null;
  modelMeta: ModelMeta | null;
  selectedNode: OnnxNode | null;
  selectedOutputKey: string | null;
  inferenceOutputs: InferenceOutputs;

  setLoadedModelBytes: (bytes: Uint8Array) => void;
  setModelMeta: (meta: ModelMeta) => void;
  setSelectedNode: (node: OnnxNode | null) => void;
  setSelectedOutputKey: (key: string | null) => void;
  setInferenceOutputs: (outputs: InferenceOutputs) => void;
  reset: () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  loadedModelBytes: null,
  modelMeta: null,
  selectedNode: null,
  selectedOutputKey: null,
  inferenceOutputs: {},

  setLoadedModelBytes: (bytes) => set({ loadedModelBytes: bytes }),
  setModelMeta: (meta) => set({ modelMeta: meta }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setSelectedOutputKey: (key) => set({ selectedOutputKey: key }),
  setInferenceOutputs: (outputs) => set({ inferenceOutputs: outputs }),
  reset: () =>
    set({
      loadedModelBytes: null,
      modelMeta: null,
      selectedNode: null,
      selectedOutputKey: null,
      inferenceOutputs: {},
    }),
}));

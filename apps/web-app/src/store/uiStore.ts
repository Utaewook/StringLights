import { create } from 'zustand';

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  engineProvider: 'webgpu' | 'wasm' | null;
  isModelLoading: boolean;
  isInferenceRunning: boolean;
  errorMsg: string | null;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setEngineProvider: (provider: 'webgpu' | 'wasm' | null) => void;
  setModelLoading: (loading: boolean) => void;
  setInferenceRunning: (running: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: false,
  engineProvider: null,
  isModelLoading: false,
  isInferenceRunning: false,
  errorMsg: null,

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setEngineProvider: (provider) => set({ engineProvider: provider }),
  setModelLoading: (loading) => set({ isModelLoading: loading }),
  setInferenceRunning: (running) => set({ isInferenceRunning: running }),
  setErrorMsg: (msg) => set({ errorMsg: msg }),
}));

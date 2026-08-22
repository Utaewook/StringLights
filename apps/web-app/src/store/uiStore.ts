import { create } from 'zustand';
import { applyTheme, resolveInitialTheme, type Theme } from '../utils/theme';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  theme: Theme;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  engineProvider: 'webgpu' | 'wasm' | null;
  isModelLoading: boolean;
  isInferenceRunning: boolean;
  errorMsg: string | null;
  toasts: ToastMessage[];

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setEngineProvider: (provider: 'webgpu' | 'wasm' | null) => void;
  setModelLoading: (loading: boolean) => void;
  setInferenceRunning: (running: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: resolveInitialTheme(),
  leftPanelOpen: true,
  rightPanelOpen: false,
  engineProvider: null,
  isModelLoading: false,
  isInferenceRunning: false,
  errorMsg: null,
  toasts: [],

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { theme: next };
    }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setEngineProvider: (provider) => set({ engineProvider: provider }),
  setModelLoading: (loading) => set({ isModelLoading: loading }),
  setInferenceRunning: (running) => set({ isInferenceRunning: running }),
  setErrorMsg: (msg) => set({ errorMsg: msg }),
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(7);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

import { create } from 'zustand';
import type { OnnxNode, TraceStep } from '../types';

interface PlaybackState {
  isActive: boolean;
  isPlaying: boolean;
  traceData: TraceStep[];
  currentStep: number;
  totalSteps: number;
  playbackSpeed: number;
  activeNodeNames: Set<string>;
  stepNonce: number;
  _timerId: ReturnType<typeof setTimeout> | null;

  setTraceData: (outputKeys: string[], nodes: OnnxNode[]) => void;
  startPlayback: () => void;
  pausePlayback: () => void;
  stopPlayback: () => void;
  seekStep: (direction: 1 | -1) => void;
  setCurrentStep: (step: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  closePlayback: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isActive: false,
  isPlaying: false,
  traceData: [],
  currentStep: -1,
  totalSteps: 0,
  playbackSpeed: 1,
  activeNodeNames: new Set(),
  stepNonce: 0,
  _timerId: null,

  setTraceData: (outputKeys, nodes) => {
    const valid = new Set(outputKeys);
    const trace: TraceStep[] = nodes
      .map((node) => {
        const key = node.outputs.find((k) => valid.has(k));
        return key ? { nodeName: node.name, outputTensorKey: key } : null;
      })
      .filter((s): s is TraceStep => s !== null);

    set({
      isActive: true,
      isPlaying: false,
      traceData: trace,
      currentStep: -1,
      totalSteps: trace.length,
      activeNodeNames: new Set(),
      stepNonce: 0,
    });
  },

  startPlayback: () => {
    const { isPlaying, currentStep, totalSteps, _timerId } = get();
    if (isPlaying) return;
    if (_timerId) clearTimeout(_timerId);

    // Restart from beginning if at end
    let startStep = currentStep;
    if (currentStep >= totalSteps - 1) {
      startStep = -1;
      set({
        currentStep: -1,
        activeNodeNames: new Set(),
        stepNonce: 0
      });
    }

    set({ isPlaying: true });

    const tick = () => {
      const state = get();
      if (!state.isPlaying) return;

      const nextStep = state.currentStep + 1;

      if (nextStep >= state.totalSteps) {
        // Reached end — stop, highlight last node
        const last = state.traceData[state.totalSteps - 1];
        set({
          isPlaying: false,
          currentStep: state.totalSteps - 1,
          activeNodeNames: last ? new Set([last.nodeName]) : new Set(),
          stepNonce: state.stepNonce + 1,
          _timerId: null,
        });
        return;
      }

      const trace = state.traceData[nextStep];
      set({
        currentStep: nextStep,
        activeNodeNames: trace ? new Set([trace.nodeName]) : state.activeNodeNames,
        stepNonce: state.stepNonce + 1,
      });

      const delay = 500 / state.playbackSpeed;
      const tid = setTimeout(tick, delay);
      set({ _timerId: tid });
    };

    // If starting from -1, tick immediately to show node 0. Else, wait delay before next.
    if (startStep === -1) {
      tick();
    } else {
      const delay = 500 / get().playbackSpeed;
      const tid = setTimeout(tick, delay);
      set({ _timerId: tid });
    }
  },

  pausePlayback: () => {
    const { _timerId } = get();
    if (_timerId) clearTimeout(_timerId);
    set({ isPlaying: false, _timerId: null });
  },

  stopPlayback: () => {
    const { _timerId } = get();
    if (_timerId) clearTimeout(_timerId);
    set({
      isPlaying: false,
      currentStep: -1,
      activeNodeNames: new Set(),
      stepNonce: 0,
      _timerId: null,
    });
  },

  seekStep: (direction) => {
    const { _timerId, currentStep, totalSteps, traceData, stepNonce } = get();
    if (_timerId) clearTimeout(_timerId);

    const nextStep = Math.max(-1, Math.min(totalSteps - 1, currentStep + direction));
    const trace = traceData[nextStep];

    set({
      isPlaying: false,
      currentStep: nextStep,
      activeNodeNames: trace ? new Set([trace.nodeName]) : new Set(),
      stepNonce: stepNonce + 1,
      _timerId: null,
    });
  },

  setCurrentStep: (step) => {
    const { _timerId, traceData, stepNonce, totalSteps } = get();
    if (_timerId) clearTimeout(_timerId);

    const clamped = Math.max(-1, Math.min(totalSteps - 1, step));
    const trace = traceData[clamped];

    set({
      isPlaying: false,
      currentStep: clamped,
      activeNodeNames: trace ? new Set([trace.nodeName]) : new Set(),
      stepNonce: stepNonce + 1,
      _timerId: null,
    });
  },

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  closePlayback: () => {
    const { _timerId } = get();
    if (_timerId) clearTimeout(_timerId);
    set({
      isActive: false,
      isPlaying: false,
      traceData: [],
      currentStep: -1,
      totalSteps: 0,
      activeNodeNames: new Set(),
      stepNonce: 0,
      _timerId: null,
    });
  },
}));

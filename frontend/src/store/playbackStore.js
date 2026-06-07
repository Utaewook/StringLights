import { create } from 'zustand'

const usePlaybackStore = create((set, get) => ({
    // State
    isActive: false,           // Whether the playback bar is visible
    isPlaying: false,          // Is the animation currently running
    currentRunId: null,        // ID of the run being replayed
    traceData: [],             // Array of {node_name, timestamp, duration, ...}
    currentTime: 0,            // Current playback time in ms (relative to start)
    totalDuration: 0,          // Total duration of the trace in ms
    playbackSpeed: 1.0,        // Speed multiplier (for 'time' mode)
    playbackMode: 'time',      // 'time' or 'step'
    stepNonce: 0,              // Increments on every step to trigger animations
    activeNodeNames: new Set(), // Produced by the ticker

    // Ticker ref
    _timerId: null,

    // Actions
    setTraceData: (runId, trace) => {
        if (!trace || trace.length === 0) return;

        // Sort trace by timestamp
        const sortedTrace = [...trace].sort((a, b) => a.timestamp - b.timestamp);
        const startTime = sortedTrace[0].timestamp;
        const actualEndTime = sortedTrace[sortedTrace.length - 1].timestamp;
        const actualDurationMs = (actualEndTime - startTime) * 1000;

        // Map events to relative actual time
        const normalizedTrace = sortedTrace.map(event => ({
            ...event,
            relativeTime: (event.timestamp - startTime) * 1000
        }));

        set((state) => ({
            isActive: true,
            currentRunId: runId,
            traceData: normalizedTrace,
            currentTime: 0,
            totalDuration: state.playbackMode === 'step' ? normalizedTrace.length * 500 : actualDurationMs,
            actualTimeDuration: actualDurationMs, // Keep for mode switching
            activeNodeNames: new Set(),
            isPlaying: false,
            playbackSpeed: 1.0,
            stepNonce: 0
        }));
    },

    setPlaybackMode: (mode) => {
        get().stopPlayback();
        const { traceData, actualTimeDuration } = get();
        const newTotal = mode === 'step' ? traceData.length * 500 : actualTimeDuration;
        set({
            playbackMode: mode,
            currentTime: 0,
            totalDuration: newTotal,
            activeNodeNames: new Set(),
            stepNonce: 0
        });
    },

    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

    startPlayback: () => {
        const { isPlaying, currentTime, totalDuration } = get();

        if (currentTime >= totalDuration) {
            set({ currentTime: 0, stepNonce: 0 });
        }

        if (isPlaying) return;
        set({ isPlaying: true });

        const tickRate = 20;
        const timerId = setInterval(() => {
            const state = get();
            const {
                currentTime, playbackSpeed, traceData, isPlaying,
                playbackMode, totalDuration, stepNonce
            } = state;

            if (!isPlaying) {
                const { _timerId } = get();
                if (_timerId) clearInterval(_timerId);
                return;
            }

            const delta = tickRate * (playbackMode === 'time' ? playbackSpeed : 1);
            let nextTime = currentTime + delta;

            if (nextTime >= totalDuration) {
                nextTime = totalDuration;
                set({ isPlaying: false, currentTime: nextTime });
                const { _timerId } = get();
                if (_timerId) clearInterval(_timerId);
                // Don't return yet, we might need to trigger the very last node update
            }

            const newActiveNodes = new Set();
            let newStepNonce = stepNonce;

            if (playbackMode === 'time') {
                // Time-based: find events in the delta
                traceData.forEach(event => {
                    if (event.relativeTime >= currentTime && event.relativeTime <= nextTime) {
                        newActiveNodes.add(event.node_name);
                        newStepNonce++;
                    }
                });
            } else {
                // Step-based: check if we crossed a 500ms boundary
                const currentIndex = Math.floor(currentTime / 500);
                const nextIndex = Math.floor(nextTime / 500);

                // If we cross into a new index, or we are at the very beginning
                if ((nextIndex > currentIndex || (currentTime === 0 && nextTime > 0)) && nextIndex < traceData.length) {
                    newActiveNodes.add(traceData[nextIndex].node_name);
                    newStepNonce++;
                } else if (nextIndex >= traceData.length && currentIndex < traceData.length) {
                    // This handles the end of the last step
                    // But usually index N-1 is already triggered at (N-1)*500
                }
            }

            // Only update activeNodeNames if we found new ones, otherwise keep previous
            // UNLESS we are at the very end or seeking, handled elsewhere
            set({
                currentTime: nextTime,
                activeNodeNames: newActiveNodes.size > 0 ? newActiveNodes : get().activeNodeNames,
                stepNonce: newStepNonce
            });
        }, tickRate);

        set({ _timerId: timerId });
    },

    pausePlayback: () => {
        const { _timerId } = get();
        if (_timerId) clearInterval(_timerId);
        set({ isPlaying: false, _timerId: null });
    },

    stopPlayback: () => {
        get().pausePlayback();
        set({
            currentTime: 0,
            activeNodeNames: new Set(),
            stepNonce: 0
        });
    },

    seek: (time) => {
        set({ currentTime: time, activeNodeNames: new Set(), stepNonce: get().stepNonce + 1 });
    },

    seekStep: (direction) => {
        const { currentTime, traceData, playbackMode, totalDuration, stepNonce } = get();

        if (playbackMode === 'step') {
            const currentIndex = Math.floor(currentTime / 500);
            let nextIndex = currentIndex + direction;
            if (nextIndex < 0) nextIndex = 0;
            if (nextIndex > traceData.length) nextIndex = traceData.length;

            const targetTime = Math.min(nextIndex * 500, totalDuration);

            // If we are at the end, don't show any highlight
            // If we are on a valid index, show it
            const newActiveNodes = nextIndex < traceData.length ? new Set([traceData[nextIndex].node_name]) : new Set();

            set({
                currentTime: targetTime,
                activeNodeNames: newActiveNodes.size > 0 ? newActiveNodes : get().activeNodeNames,
                isPlaying: false,
                stepNonce: stepNonce + 1
            });
        } else {
            // Original 'time' based logic for steps
            let targetTime;
            if (direction > 0) {
                const nextEvent = traceData.find(e => e.relativeTime > currentTime + 1);
                targetTime = nextEvent ? nextEvent.relativeTime : totalDuration;
            } else {
                const prevEvents = traceData.filter(e => e.relativeTime < currentTime - 1);
                targetTime = prevEvents.length > 0 ? prevEvents[prevEvents.length - 1].relativeTime : 0;
            }

            const newActiveNodes = new Set();
            traceData.forEach(event => {
                if (Math.abs(event.relativeTime - targetTime) < 10) {
                    newActiveNodes.add(event.node_name);
                }
            });

            set({
                currentTime: targetTime,
                activeNodeNames: newActiveNodes.size > 0 ? newActiveNodes : get().activeNodeNames,
                isPlaying: false,
                stepNonce: stepNonce + 1
            });
        }
    },

    setSpeed: (speed) => set({ playbackSpeed: speed }),

    closePlayback: () => {
        get().pausePlayback();
        set({ isActive: false, currentRunId: null, traceData: [] });
    }
}));

export default usePlaybackStore;

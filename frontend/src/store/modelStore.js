import { create } from 'zustand'

const useModelStore = create((set) => ({
    selectedModel: null,
    setSelectedModel: (model) => set({ selectedModel: model, selectedNode: null }), // Reset node on model change
    selectedNode: null,
    setSelectedNode: (node) => set({ selectedNode: node }),

    // Model Inputs (generated or uploaded data sets)
    modelInputs: {}, // { modelId: [ { name: 'inputs.npz', type: 'auto' }, ... ] }
    addModelInput: (modelId, input) => set((state) => ({
        modelInputs: {
            ...state.modelInputs,
            [modelId]: [...(state.modelInputs[modelId] || []), input]
        }
    })),
}))

export default useModelStore

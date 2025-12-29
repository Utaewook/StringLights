import { create } from 'zustand'

const useModelStore = create((set) => ({
    selectedModel: null,
    setSelectedModel: (model) => set({ selectedModel: model, selectedNode: null }), // Reset node on model change
    selectedNode: null,
    setSelectedNode: (node) => set({ selectedNode: node }),

    // Model Datasets (multiple input sets per model)
    datasets: {}, // { modelId: [ { id, name, type, created_at, ... }, ... ] }
    setDatasets: (modelId, datasetList) => set((state) => ({
        datasets: {
            ...state.datasets,
            [modelId]: datasetList
        }
    })),
    addDataset: (modelId, dataset) => set((state) => ({
        datasets: {
            ...state.datasets,
            [modelId]: [dataset, ...(state.datasets[modelId] || [])]
        }
    })),
}))

export default useModelStore

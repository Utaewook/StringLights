import { create } from 'zustand'

const useModelStore = create((set) => ({
    selectedModel: null,
    setSelectedModel: (model) => set({ selectedModel: model, selectedNode: null }), // Reset node on model change
    selectedNode: null,
    setSelectedNode: (node) => set({ selectedNode: node, selectedDataset: null }), // Reset dataset on node change
    selectedDataset: null,
    setSelectedDataset: (dataset) => set({ selectedDataset: dataset, selectedNode: null }), // Reset node on dataset change

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
    // Tensors inside each dataset
    datasetTensors: {}, // { datasetId: [ { name, size_bytes, tensor_name }, ... ] }
    setDatasetTensors: (datasetId, tensorList) => set((state) => ({
        datasetTensors: {
            ...state.datasetTensors,
            [datasetId]: tensorList
        }
    })),
}))

export default useModelStore

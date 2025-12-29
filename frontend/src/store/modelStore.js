import { create } from 'zustand'

const useModelStore = create((set) => ({
    selectedModel: null,
    setSelectedModel: (model) => set({ selectedModel: model, selectedNode: null }), // Reset node on model change
    selectedNode: null,
    setSelectedNode: (node) => set({ selectedNode: node }),
}))

export default useModelStore

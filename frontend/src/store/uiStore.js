import { create } from 'zustand'

const useUIStore = create((set) => ({
    leftPanelOpen: true,
    rightPanelOpen: false,
    theme: 'dark',
    toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
    setRightPanelOpen: (isOpen) => set({ rightPanelOpen: isOpen }),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}))

export default useUIStore

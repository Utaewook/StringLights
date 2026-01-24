
import { create } from 'zustand';

const useNotificationStore = create((set, get) => ({
    notifications: [],

    // Add a notification
    // type: 'success' | 'error' | 'info' | 'warning'
    // duration: auto-dismiss time in ms (default 1500ms)
    addNotification: (message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random();
        const newNotif = { id, message, type, duration };

        set(state => ({
            notifications: [...state.notifications, newNotif]
        }));

        if (duration > 0) {
            setTimeout(() => {
                get().removeNotification(id);
            }, duration);
        }
    },

    removeNotification: (id) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    }
}));

export default useNotificationStore;

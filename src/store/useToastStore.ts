import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, options?: { title?: string; duration?: number }) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'success', options = {}) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = options.duration ?? 4000;

    const newToast: ToastItem = {
      id,
      message,
      title: options.title,
      type,
      duration,
    };

    set((state) => ({
      toasts: [...state.toasts.slice(-4), newToast], // Keep max 5 toasts
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

// Convenient singleton helper for direct non-react calls
export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'success', { title, duration }),
  error: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'error', { title, duration }),
  info: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'info', { title, duration }),
  warning: (message: string, title?: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'warning', { title, duration }),
  dismiss: (id: string) => useToastStore.getState().removeToast(id),
  clear: () => useToastStore.getState().clearToasts(),
};

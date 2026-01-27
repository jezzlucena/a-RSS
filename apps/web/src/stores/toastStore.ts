import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    const newToast: Toast = {
      id,
      duration: 5000, // 5 seconds default
      ...toast,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Note: Auto-dismiss is now handled by the ToastItem component
    // to support pause-on-hover functionality
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => set({ toasts: [] }),
}));

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'error', duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'info', duration }),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'warning', duration }),
};

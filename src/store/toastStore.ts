import { create } from 'zustand';

export interface Toast {
  id:         string;
  sessionId:  string;
  flowId:     string;
  flowName:   string;
  kind:       'success' | 'error';
  durationMs: number;
}

interface ToastStore {
  toasts: Toast[];
  add:    (t: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    set(s => ({ toasts: [...s.toasts, { ...t, id }] }));
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

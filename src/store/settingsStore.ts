import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings';

interface SettingsStore {
  settings: AppSettings;
  update:   (patch: Partial<AppSettings>) => void;
  reset:    () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: { ...DEFAULT_SETTINGS },
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      reset:  () => set({ settings: { ...DEFAULT_SETTINGS } }),
    }),
    {
      name:    'autoflow.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Merge with defaults so newly-added settings keys take their default
      // value on existing installs instead of arriving as `undefined`.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsStore>;
        return {
          ...current,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);

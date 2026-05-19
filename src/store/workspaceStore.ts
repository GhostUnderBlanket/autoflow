import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface LegacySummary {
  flows: number;
  root:  string;
}

interface MigrationResult {
  moved_flows: number;
}

interface WorkspaceStore {
  path:    string | null;
  loaded:  boolean;       // true after the marker has been read once
  refresh: () => Promise<void>;
  set:     (path: string) => Promise<void>;
  suggested: () => Promise<string>;
  legacySummary: () => Promise<LegacySummary>;
  migrateLegacy: () => Promise<MigrationResult>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  path:   null,
  loaded: false,

  refresh: async () => {
    try {
      const p = await invoke<string | null>('get_workspace');
      set({ path: p ?? null, loaded: true });
    } catch (e) {
      console.warn('[workspaceStore] get_workspace failed:', e);
      set({ path: null, loaded: true });
    }
  },

  set: async (path) => {
    const final = await invoke<string>('set_workspace', { path });
    set({ path: final });
  },

  suggested: () => invoke<string>('suggested_workspace_path'),

  legacySummary: () => invoke<LegacySummary>('legacy_appdata_summary'),

  migrateLegacy: () => invoke<MigrationResult>('migrate_legacy_to_workspace'),
}));

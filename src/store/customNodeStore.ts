import { create } from 'zustand';
import { readDir, readTextFile, writeTextFile, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { useWorkspaceStore } from './workspaceStore';
import type { CustomNodeDef } from '../types/customNode';

function customNodesDir(): string | null {
  const ws = useWorkspaceStore.getState().path;
  if (!ws) return null;
  return `${ws}/custom-nodes`;
}

interface CustomNodeStore {
  defs:       CustomNodeDef[];
  loaded:     boolean;
  loadDefs:   () => Promise<void>;
  installDef: (def: CustomNodeDef) => Promise<void>;
  removeDef:  (id: string) => Promise<void>;
}

export const useCustomNodeStore = create<CustomNodeStore>((set) => ({
  defs:   [],
  loaded: false,

  loadDefs: async () => {
    const dir = customNodesDir();
    if (!dir) { set({ loaded: true }); return; }
    try {
      const dirExists = await exists(dir);
      if (!dirExists) {
        await mkdir(dir, { recursive: true });
        set({ defs: [], loaded: true });
        return;
      }
      const entries = await readDir(dir);
      const defs: CustomNodeDef[] = [];
      for (const entry of entries) {
        if (!entry.isFile || !entry.name?.endsWith('.json')) continue;
        try {
          const text = await readTextFile(`${dir}/${entry.name}`);
          const def = JSON.parse(text) as CustomNodeDef;
          if (def.id && def.label && Array.isArray(def.fields) && def.executor) {
            defs.push(def);
          }
        } catch (e) {
          console.warn(`[customNodeStore] failed to parse ${entry.name}:`, e);
        }
      }
      set({ defs, loaded: true });
    } catch (e) {
      console.warn('[customNodeStore] loadDefs failed:', e);
      set({ loaded: true });
    }
  },

  installDef: async (def: CustomNodeDef) => {
    const dir = customNodesDir();
    if (!dir) return;
    try {
      const dirExists = await exists(dir);
      if (!dirExists) await mkdir(dir, { recursive: true });
      await writeTextFile(`${dir}/${def.id}.json`, JSON.stringify(def, null, 2));
      set(s => ({
        defs: s.defs.some(d => d.id === def.id)
          ? s.defs.map(d => d.id === def.id ? def : d)
          : [...s.defs, def],
      }));
    } catch (e) {
      console.warn('[customNodeStore] installDef failed:', e);
      throw e;
    }
  },

  removeDef: async (id: string) => {
    const dir = customNodesDir();
    if (!dir) return;
    try {
      const path = `${dir}/${id}.json`;
      const fileExists = await exists(path);
      if (fileExists) await remove(path);
      set(s => ({ defs: s.defs.filter(d => d.id !== id) }));
    } catch (e) {
      console.warn('[customNodeStore] removeDef failed:', e);
      throw e;
    }
  },
}));

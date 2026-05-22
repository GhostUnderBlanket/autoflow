/**
 * Secrets store — global key-value store for sensitive values that should NOT
 * appear in flow JSON files or be visible in run logs (they are masked to ***).
 *
 * Referenced in any node field with ${secret:NAME}.
 * Persisted to localStorage under the key 'autoflow-secrets'.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SecretsState {
  secrets:      Record<string, string>;
  setSecret:    (name: string, value: string) => void;
  deleteSecret: (name: string) => void;
  renameSecret: (oldName: string, newName: string) => void;
}

export const useSecretsStore = create<SecretsState>()(
  persist(
    (set) => ({
      secrets: {},

      setSecret: (name, value) =>
        set(s => ({ secrets: { ...s.secrets, [name]: value } })),

      deleteSecret: (name) =>
        set(s => {
          const next = { ...s.secrets };
          delete next[name];
          return { secrets: next };
        }),

      renameSecret: (oldName, newName) =>
        set(s => {
          const next = { ...s.secrets };
          const val = next[oldName];
          delete next[oldName];
          if (newName.trim()) next[newName.trim()] = val ?? '';
          return { secrets: next };
        }),
    }),
    { name: 'autoflow-secrets' },
  ),
);

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LogEntry } from '../types/flow';

export interface RunSession {
  id:          string;
  flowId:      string;
  flowName:    string;
  trigger:     'manual' | 'cron' | 'catch-up';
  startedAt:   number;
  finishedAt?: number;
  status:      'running' | 'success' | 'error';
  logs:        LogEntry[];
}

interface RunLogStore {
  sessions: RunSession[];
  start:  (flowId: string, flowName: string, trigger: RunSession['trigger']) => string;
  append: (sessionId: string, message: string, level: LogEntry['level']) => void;
  finish: (sessionId: string, ok: boolean) => void;
  clear:  () => void;
}

const MAX_SESSIONS = 100;

function mkId() { return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function mkLog(message: string, level: LogEntry['level'] = 'info'): LogEntry {
  return { id: mkId(), timestamp: Date.now(), level, message };
}

export const useRunLogStore = create<RunLogStore>()(
  persist(
    (set) => ({
      sessions: [],

      start: (flowId, flowName, trigger) => {
        const id: string = mkId();
        const session: RunSession = {
          id, flowId, flowName, trigger,
          startedAt: Date.now(),
          status: 'running',
          logs: [],
        };
        set(s => ({
          sessions: [session, ...s.sessions].slice(0, MAX_SESSIONS),
        }));
        return id;
      },

      append: (sessionId, message, level = 'info') => {
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id === sessionId
              ? { ...sess, logs: [...sess.logs, mkLog(message, level)] }
              : sess,
          ),
        }));
      },

      finish: (sessionId, ok) => {
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id === sessionId
              ? { ...sess, status: ok ? 'success' : 'error', finishedAt: Date.now() }
              : sess,
          ),
        }));
      },

      clear: () => set({ sessions: [] }),
    }),
    {
      name:    'autoflow.runlog',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // On reload any session still marked 'running' crashed mid-run — mark error.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RunLogStore>;
        const sessions = ((p.sessions ?? []) as RunSession[]).map(s =>
          s.status === 'running' ? { ...s, status: 'error' as const, finishedAt: s.finishedAt ?? Date.now() } : s
        );
        return { ...current, sessions };
      },
    },
  ),
);

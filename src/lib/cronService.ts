import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useFlowStore } from '../store/flowStore';
import type { Flow } from '../types/flow';
import { runFlowInBackground } from './backgroundRunner';

interface ScheduledFlow {
  flowId:   string;
  cron:     string;
  catchUp:  'skip' | 'run-once' | 'run-all';
}

export interface FlowJobState {
  flowId:    string;
  cron:      string;
  nextFire:  number | null;
  lastFired: number | null;
}

/** Find the cron trigger on a flow (returns null if none / disabled). */
function cronOf(flow: Flow): ScheduledFlow | null {
  const trig = flow.nodes.find(n => n.type === 'trigger' && (n.data as { mode?: string }).mode === 'cron');
  if (!trig) return null;
  const d = trig.data as { cron?: string; catchUp?: string; enabled?: boolean };
  if (d.enabled === false) return null;
  const cron = (d.cron ?? '').trim();
  if (!cron) return null;
  const catchUp = (d.catchUp as ScheduledFlow['catchUp']) ?? 'skip';
  return { flowId: flow.id, cron, catchUp };
}

function deriveSchedules(flows: Flow[]): ScheduledFlow[] {
  return flows.map(cronOf).filter((s): s is ScheduledFlow => s !== null);
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
let lastJson = '';

function scheduleReload(flows: Flow[]) {
  const list = deriveSchedules(flows);
  const json = JSON.stringify(list);
  if (json === lastJson) {
    console.debug('[cronService] reload skipped (no change). flows=', flows.length, 'armed=', list.length);
    return;
  }
  lastJson = json;
  console.info('[cronService] reload queued. flows=', flows.length, 'armed=', list.length, list);

  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    console.info('[cronService] invoking scheduler_reload', list);
    invoke('scheduler_reload', { flows: list })
      .then(() => console.info('[cronService] scheduler_reload OK'))
      .catch(e => console.error('[cronService] scheduler_reload FAILED:', e));
  }, 250);
}

let unlistenFire: UnlistenFn | null = null;
let storeUnsubscribe: (() => void) | null = null;

interface FireEvent { flowId: string; scheduledAt: number; catchUp: boolean }

export async function initCronService(): Promise<void> {
  if (unlistenFire) {
    console.debug('[cronService] init skipped — already running');
    return;
  }
  console.info('[cronService] init');

  unlistenFire = await listen<FireEvent>('flow-fire', (e) => {
    console.info('[cronService] flow-fire received', e.payload);
    const { flowId, catchUp } = e.payload;
    runFlowInBackground(flowId, catchUp ? 'catch-up' : 'cron');
  });

  // Initial sync — bypass the lastJson cache so we always reload on startup.
  lastJson = '';
  scheduleReload(useFlowStore.getState().flows);
  storeUnsubscribe = useFlowStore.subscribe((state, prev) => {
    if (state.flows !== prev.flows) scheduleReload(state.flows);
  });
}

export function teardownCronService(): void {
  if (unlistenFire) { void unlistenFire(); unlistenFire = null; }
  if (storeUnsubscribe) { storeUnsubscribe(); storeUnsubscribe = null; }
}

export async function fetchSchedulerState(): Promise<FlowJobState[]> {
  try {
    return await invoke<FlowJobState[]>('scheduler_get_state');
  } catch (e) {
    console.error('[cronService] scheduler_get_state failed:', e);
    return [];
  }
}

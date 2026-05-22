import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useFlowStore } from '../store/flowStore';
import type { Flow } from '../types/flow';
import { runFlowInBackground } from './backgroundRunner';
import { useToastStore } from '../store/toastStore';

interface ScheduledFlow {
  flowId:   string;
  cron:     string;
  catchUp:  'skip' | 'run-once' | 'run-all';
}

interface WatchedFlow {
  flowId: string;
  path:   string;
}

interface WebhookFlow {
  flowId: string;
  port:   number;
  path:   string;
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

/** Resolve ${var:X} references in a string using flow variables only. */
function resolveVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\$\{\s*var:([^}]+?)\s*\}/g, (_, name) => vars[name.trim()] ?? '');
}

function watchOf(flow: Flow): WatchedFlow | null {
  const trig = flow.nodes.find(n => n.type === 'trigger' && (n.data as { mode?: string }).mode === 'watch');
  if (!trig) return null;
  const d = trig.data as { watchPath?: string; enabled?: boolean };
  if (d.enabled === false) return null;
  const rawPath = (d.watchPath ?? '').trim();
  if (!rawPath) return null;
  const resolved = resolveVars(rawPath, flow.variables ?? {});
  // Strip surrounding quotes that users sometimes paste along with paths
  const path = resolved.replace(/^["']+|["']+$/g, '').trim();
  if (!path) return null;
  return { flowId: flow.id, path };
}

function webhookOf(flow: Flow): WebhookFlow | null {
  const trig = flow.nodes.find(n => n.type === 'trigger' && (n.data as { mode?: string }).mode === 'webhook');
  if (!trig) return null;
  const d = trig.data as { port?: number; webhookPath?: string; enabled?: boolean };
  if (d.enabled === false) return null;
  const port = Number(d.port ?? 0);
  if (!port || port < 1 || port > 65535) return null;
  const rawPath = (d.webhookPath ?? '/').trim() || '/';
  const path = resolveVars(rawPath, flow.variables ?? {});
  return { flowId: flow.id, port, path: path || '/' };
}

function deriveSchedules(flows: Flow[]): ScheduledFlow[] {
  return flows.map(cronOf).filter((s): s is ScheduledFlow => s !== null);
}

function deriveWatched(flows: Flow[]): WatchedFlow[] {
  return flows.map(watchOf).filter((s): s is WatchedFlow => s !== null);
}

function deriveWebhooks(flows: Flow[]): WebhookFlow[] {
  return flows.map(webhookOf).filter((s): s is WebhookFlow => s !== null);
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
let lastJson = '';

function scheduleReload(flows: Flow[]) {
  const cronList    = deriveSchedules(flows);
  const watchList   = deriveWatched(flows);
  const webhookList = deriveWebhooks(flows);
  const json = JSON.stringify({ cronList, watchList, webhookList });
  if (json === lastJson) return;
  lastJson = json;

  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    invoke('scheduler_reload', { flows: cronList })
      .catch(e => console.error('[cronService] scheduler_reload FAILED:', e));
    invoke('watch_reload', { flows: watchList })
      .catch(e => console.error('[cronService] watch_reload FAILED:', e));
    invoke('webhook_reload', { flows: webhookList })
      .catch(e => console.error('[cronService] webhook_reload FAILED:', e));
  }, 250);
}

let unlistenFire:       UnlistenFn | null = null;
let unlistenWatch:      UnlistenFn | null = null;
let unlistenWebhook:    UnlistenFn | null = null;
let unlistenWatchError: UnlistenFn | null = null;
let storeUnsubscribe: (() => void) | null = null;

interface FireEvent    { flowId: string; scheduledAt: number; catchUp: boolean }
interface WatchEvent   { flowId: string; kind: string; paths?: string[] }
interface WebhookEvent { flowId: string; body: string }

export async function initCronService(): Promise<void> {
  if (unlistenFire) {
    console.debug('[cronService] init skipped — already running');
    return;
  }
  console.info('[cronService] init');

  unlistenFire = await listen<FireEvent>('flow-fire', (e) => {
    const { flowId, catchUp } = e.payload;
    runFlowInBackground(flowId, catchUp ? 'catch-up' : 'cron');
  });

  unlistenWatch = await listen<WatchEvent>('file-watch-fire', (e) => {
    console.info('[cronService] file-watch-fire', e.payload);
    // Pass the changed file path as trigger output so ${prev} works downstream
    runFlowInBackground(e.payload.flowId, 'cron', e.payload.paths?.[0] ?? e.payload.kind);
  });

  unlistenWebhook = await listen<WebhookEvent>('webhook-fire', (e) => {
    console.info('[cronService] webhook-fire', e.payload);
    // Pass request body as trigger output so ${prev} resolves to it in the next node
    runFlowInBackground(e.payload.flowId, 'cron', e.payload.body ?? '');
  });

  unlistenWatchError = await listen<{ flowId: string; error: string }>('watch-setup-error', (e) => {
    console.error('[cronService] watch-setup-error', e.payload);
    const flow = useFlowStore.getState().flows.find(f => f.id === e.payload.flowId);
    const name = flow?.name ?? e.payload.flowId;
    useToastStore.getState().add({
      sessionId:  `watch-err-${Date.now()}`,
      flowId:     e.payload.flowId,
      flowName:   name,
      kind:       'error',
      durationMs: 0,
    });
  });

  // Initial sync
  lastJson = '';
  scheduleReload(useFlowStore.getState().flows);
  storeUnsubscribe = useFlowStore.subscribe((state, prev) => {
    if (state.flows !== prev.flows) scheduleReload(state.flows);
  });
}

export function teardownCronService(): void {
  if (unlistenFire)       { void unlistenFire();       unlistenFire       = null; }
  if (unlistenWatch)      { void unlistenWatch();      unlistenWatch      = null; }
  if (unlistenWebhook)    { void unlistenWebhook();    unlistenWebhook    = null; }
  if (unlistenWatchError) { void unlistenWatchError(); unlistenWatchError = null; }
  if (storeUnsubscribe)   { storeUnsubscribe();        storeUnsubscribe   = null; }
}

export async function fetchSchedulerState(): Promise<FlowJobState[]> {
  try {
    return await invoke<FlowJobState[]>('scheduler_get_state');
  } catch (e) {
    console.error('[cronService] scheduler_get_state failed:', e);
    return [];
  }
}

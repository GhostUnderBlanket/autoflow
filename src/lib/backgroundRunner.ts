import { runFlow } from './executor';
import { useFlowStore } from '../store/flowStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSecretsStore } from '../store/secretsStore';
import { useRunLogStore } from '../store/runLogStore';
import { useToastStore } from '../store/toastStore';

/**
 * When a flow is currently open in the FlowEditor, it registers a callback here
 * so background triggers (cron/watch/webhook) route the run through the editor's
 * own run mechanism — giving live log output and node status rings.
 *
 * Key: flow id.  Value: callback that starts a visual run.
 */
const editorRunCallbacks = new Map<string, (triggerOutput?: string) => void>();

export function registerEditorCallback(
  flowId: string,
  cb: (triggerOutput?: string) => void,
): () => void {
  editorRunCallbacks.set(flowId, cb);
  return () => {
    if (editorRunCallbacks.get(flowId) === cb) editorRunCallbacks.delete(flowId);
  };
}
import type { Node, Edge } from '@xyflow/react';
import {
  isPermissionGranted, requestPermission, sendNotification,
} from '@tauri-apps/plugin-notification';

/**
 * Ensure notification permission is granted (or denied). Call once at app
 * startup so the user gets a single OS-native prompt instead of being
 * surprised mid-run.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    const res = await requestPermission();
    return res === 'granted';
  } catch (e) {
    console.warn('[notify] permission request failed:', e);
    return false;
  }
}

/**
 * Fire a native OS notification. No window-visibility check — cron / catch-up
 * runs are background-by-definition and the user wants to know.
 */
async function notify(title: string, body: string): Promise<void> {
  try {
    if (!(await isPermissionGranted())) {
      const res = await requestPermission();
      if (res !== 'granted') return;
    }
    sendNotification({ title, body });
  } catch (e) {
    console.warn('[notify] failed:', e);
  }
}

/**
 * Run a flow by id without a UI panel attached (used for cron-fired runs and
 * the home-page Run button). Updates flow.status / flow.lastRun in the store
 * and pipes every line into the global run log.
 */
export function runFlowInBackground(flowId: string, reason: 'cron' | 'catch-up' | 'manual' = 'cron', triggerOutput?: string): void {
  const flow = useFlowStore.getState().flows.find(f => f.id === flowId);
  if (!flow) {
    console.warn(`[bg-runner] flow ${flowId} not found`);
    return;
  }
  if (flow.status === 'running') {
    console.warn(`[bg-runner] flow ${flowId} already running — skipping`);
    return;
  }

  // If the FlowEditor has this flow open it registers a callback above.
  // Route the run there so the user sees the live log panel and node rings.
  const editorCb = editorRunCallbacks.get(flowId);
  if (editorCb) {
    editorCb(triggerOutput);
    return;
  }

  const settings = useSettingsStore.getState().settings;
  const { updateFlow } = useFlowStore.getState();

  console.info(`[bg-runner] ${reason} fire → ${flow.name} (${flowId})`);
  updateFlow(flowId, { status: 'running' });

  // Notify on background runs only — manual runs don't need a toast since the
  // user is right here and can see the run log update.
  if (reason !== 'manual') {
    const kind = reason === 'catch-up' ? 'Catch-up' : 'Scheduled';
    void notify('Autoflow', `${kind} run started: ${flow.name}`);
  }

  const { start, append, finish } = useRunLogStore.getState();
  const sessionId = start(flowId, flow.name, reason);
  const startedAt = Date.now();

  const secrets = useSecretsStore.getState().secrets;
  runFlow(
    flow.nodes.map(n => ({ ...n, data: { label: n.label, ...n.data } })) as unknown as Node[],
    flow.edges as unknown as Edge[],
    settings,
    flow.variables ?? {},
    secrets,
    {
      onLog:       (msg, lvl = 'info') => append(sessionId, msg, lvl),
      onNodeStart: () => {},
      onNodeDone:  () => {},
      onDone:      (ok) => {
        updateFlow(flowId, {
          status:  ok ? 'success' : 'error',
          lastRun: Date.now(),
        });
        finish(sessionId, ok);
        useToastStore.getState().add({
          sessionId,
          flowId,
          flowName:   flow.name,
          kind:       ok ? 'success' : 'error',
          durationMs: Date.now() - startedAt,
        });
        if (reason !== 'manual') {
          void notify('Autoflow', `${flow.name} ${ok ? 'finished successfully' : 'failed'}`);
        }
      },
    },
    undefined,      // _callStack
    triggerOutput,  // body / watch event data → becomes trigger node stdout
  );
}

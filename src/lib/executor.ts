import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { Node, Edge } from '@xyflow/react';
import type { AppSettings } from '../types/settings';
import type { LogEntry } from '../types/flow';
import { interpolate, type NodeRunResult } from './interpolate';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface BodyRow { key: string; value: string }

export type AddLog = (message: string, level?: LogEntry['level']) => void;

/* ─── Topological sort ─────────────────────────────────────── */

function topSort(nodes: Node[], edges: Edge[]): Node[] {
  const degree = new Map(nodes.map(n => [n.id, 0]));
  const adj    = new Map(nodes.map(n => [n.id, [] as string[]]));

  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const queue = nodes.filter(n => (degree.get(n.id) ?? 0) === 0);
  const out: Node[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    out.push(node);
    for (const next of (adj.get(node.id) ?? [])) {
      const d = (degree.get(next) ?? 0) - 1;
      degree.set(next, d);
      if (d === 0) { const n = nodes.find(n => n.id === next); if (n) queue.push(n); }
    }
  }
  for (const n of nodes) { if (!out.find(o => o.id === n.id)) out.push(n); }
  return out;
}

function parentsOf(nodeId: string, edges: Edge[]): string[] {
  return edges.filter(e => e.target === nodeId).map(e => e.source);
}

/* ─── Condition evaluation ─────────────────────────────────── */

function evalCondition(
  node: Node,
  results: Map<string, NodeRunResult>,
  parents: string[],
): boolean {
  const d   = (node.data ?? {}) as Record<string, unknown>;
  const op  = (d.op as string) || 'nonempty';
  const ctx = { results, parents };

  if (op === 'exitZero') {
    const last = parents.length > 0 ? results.get(parents[parents.length - 1]) : undefined;
    return last?.exitCode === 0;
  }

  const sourceTpl = (d.source as string) ?? '${prev}';
  const subject   = interpolate(sourceTpl, ctx).trim();

  switch (op) {
    case 'equals':    return subject === interpolate((d.value as string) ?? '', ctx).trim();
    case 'notEquals': return subject !== interpolate((d.value as string) ?? '', ctx).trim();
    case 'contains':  return subject.includes(interpolate((d.value as string) ?? '', ctx).trim());
    case 'matches':   {
      const pat = interpolate((d.value as string) ?? '', ctx).trim();
      if (!pat) return false;
      try { return new RegExp(pat).test(subject); } catch { return false; }
    }
    case 'empty':     return subject.length === 0;
    case 'nonempty':  return subject.length > 0;
    default:          return subject.length > 0;
  }
}

/* ─── Subprocess execution ─────────────────────────────────── */

interface SpawnHandle {
  result: Promise<{ exitCode: number | null; stdout: string }>;
  kill:   () => Promise<void>;
}

function spawnSubprocess(
  id: string,
  program: string,
  args: string[],
  cwd: string | undefined,
  onLog: AddLog,
): SpawnHandle {
  const captured: string[] = [];

  const result = (async (): Promise<{ exitCode: number | null; stdout: string }> => {
    const unlisten = await Promise.all([
      listen<string>(`exec-out-${id}`, e => {
        const line = e.payload.trimEnd();
        if (!line) return;
        captured.push(line);
        onLog(line, 'info');
      }),
      listen<string>(`exec-err-${id}`, e => {
        const line = e.payload.trimEnd();
        if (line) onLog(line, 'warn');
      }),
    ]);

    try {
      const exitCode = await invoke<number>('exec_node', {
        opts: { id, program, args, cwd: cwd ?? null },
      });
      return { exitCode, stdout: captured.join('\n') };
    } catch (e) {
      onLog(`Error: ${String(e)}`, 'error');
      return { exitCode: -1, stdout: captured.join('\n') };
    } finally {
      unlisten.forEach(u => u());
    }
  })();

  return {
    result,
    kill: async () => {
      try { await invoke('kill_exec', { id }); } catch { /* ignore */ }
    },
  };
}

/* ─── REST API HTTP request ────────────────────────────────── */

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}… (+${s.length - n} chars)`;
}

function coerceFormValue(raw: string): unknown {
  const t = raw.trim();
  if (t === '')      return '';
  if (t === 'true')  return true;
  if (t === 'false') return false;
  if (t === 'null')  return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

function restRequest(
  d: Record<string, unknown>,
  settings: AppSettings,
  interp: (s: string) => string,
  onLog: AddLog,
): SpawnHandle {
  const baseUrl  = (settings.restBaseUrl || '').replace(/\/+$/, '');
  const endpoint = interp(((d.endpoint as string) ?? '')).trim().replace(/^\/+/, '');
  if (!baseUrl) {
    onLog('   ✗ REST API base URL not configured (Settings → REST API)', 'error');
    return { result: Promise.resolve({ exitCode: 1, stdout: '' }), kill: async () => {} };
  }
  if (!endpoint) {
    onLog('   ✗ endpoint is empty', 'error');
    return { result: Promise.resolve({ exitCode: 1, stdout: '' }), kill: async () => {} };
  }
  const url      = `${baseUrl}/${endpoint}`;
  const method   = (((d.method as string) || 'POST').toUpperCase());
  const override = ((d.tokenOverride as string) ?? '').trim();
  const token    = override || settings.restToken;

  // Build body
  let bodyText: string | undefined;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (hasBody) {
    const bodyMode = (d.bodyMode as string) === 'json' ? 'json' : 'form';
    if (bodyMode === 'form') {
      const rows = ((d.bodyRows as BodyRow[]) ?? []).filter(r => (r.key ?? '').trim() !== '');
      const obj: Record<string, unknown> = {};
      for (const r of rows) {
        const key = (r.key ?? '').trim();
        const raw = interp(String(r.value ?? ''));
        obj[key]  = coerceFormValue(raw);
      }
      bodyText = JSON.stringify(obj);
    } else {
      const raw = interp(((d.body as string) ?? '')).trim();
      if (raw) {
        try { JSON.parse(raw); }
        catch (e) {
          onLog(`   ✗ body is not valid JSON: ${String(e)}`, 'error');
          return { result: Promise.resolve({ exitCode: 1, stdout: '' }), kill: async () => {} };
        }
        bodyText = raw;
      }
    }
  }

  onLog(`   ${method} ${url}`, 'info');
  if (bodyText) onLog(`   body: ${truncate(bodyText, 200)}`, 'info');
  if (!token) onLog('   ⚠ no bearer token set — request will be unauthenticated', 'warn');

  const aborter = new AbortController();
  const result = (async (): Promise<{ exitCode: number | null; stdout: string }> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await tauriFetch(url, {
        method,
        headers,
        body: bodyText,
        signal: aborter.signal,
      });
      const text = await res.text();
      const ok   = res.status >= 200 && res.status < 300;
      onLog(`   ← ${res.status} ${res.statusText || ''}`.trimEnd(), ok ? 'success' : 'error');
      if (text) onLog(truncate(text, 500), ok ? 'info' : 'warn');
      return { exitCode: ok ? 0 : 1, stdout: text };
    } catch (e) {
      onLog(`   ✗ request failed: ${String(e)}`, 'error');
      return { exitCode: -1, stdout: '' };
    }
  })();

  return {
    result,
    kill: async () => { aborter.abort(); },
  };
}

/* ─── Build the execution handle for a node ────────────────── */

function execNode(
  node: Node,
  settings: AppSettings,
  onLog: AddLog,
  results: Map<string, NodeRunResult>,
  parents: string[],
): SpawnHandle | null {
  const d    = node.data as Record<string, unknown>;
  const type = node.type ?? 'script';

  if (type === 'trigger' || type === 'condition') return null;

  const ctx = { results, parents };
  const interp = (s: string) => interpolate(s, ctx);

  const workspacePath = useWorkspaceStore.getState().path ?? '';
  const cwd = ((d.workDir as string) || workspacePath) || undefined;
  const id  = `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (type === 'rest') {
    return restRequest(d, settings, interp, onLog);
  }

  // Script node
  const shell  = (d.shell as string) || settings.defaultShell;
  const script = interp((d.script as string) ?? '');

  let program: string, args: string[];
  if (shell === 'powershell') { program = 'powershell'; args = ['-NonInteractive', '-Command', script]; }
  else if (shell === 'bash')  { program = 'bash';        args = ['-c', script]; }
  else                        { program = 'cmd';         args = ['/c', script]; }

  return spawnSubprocess(id, program, args, cwd ? interp(cwd) : cwd, onLog);
}

/* ─── Public API ────────────────────────────────────────────── */

export interface RunCallbacks {
  onLog:        AddLog;
  onNodeStart:  (nodeId: string) => void;
  onNodeDone:   (nodeId: string, exitCode: number | null) => void;
  onDone:       (success: boolean) => void;
}

export interface RunHandle {
  stop: () => Promise<void>;
}

export function runFlow(
  nodes: Node[],
  edges: Edge[],
  settings: AppSettings,
  cbs: RunCallbacks,
): RunHandle {
  const signal = { stopped: false };
  let stopCurrent: (() => Promise<void>) | null = null;

  const stop = async () => {
    signal.stopped = true;
    if (stopCurrent) await stopCurrent();
  };

  void (async () => {
    const ordered = topSort(nodes, edges);
    cbs.onLog(`▶  ${ordered.length} node${ordered.length !== 1 ? 's' : ''} queued`, 'info');

    let flowOk = true;
    const results = new Map<string, NodeRunResult>();

    /**
     * A node is "skipped" when every incoming edge is dead.
     *  - An edge is dead if its source is skipped, or
     *  - the source is a condition node whose evaluated branch ≠ the edge's sourceHandle.
     * Nodes with no incoming edges (root triggers) are always live.
     */
    const skipped       = new Set<string>();
    const liveBranches  = new Map<string, 'true' | 'false'>(); // condition id → branch that's alive

    function edgeIsDead(e: Edge): boolean {
      if (skipped.has(e.source)) return true;
      const branch = liveBranches.get(e.source);
      if (!branch) return false;            // source isn't a condition; just a regular link
      const handle = (e.sourceHandle ?? 'true') as 'true' | 'false';
      return handle !== branch;
    }

    function shouldSkip(nodeId: string): boolean {
      const incoming = edges.filter(e => e.target === nodeId);
      if (incoming.length === 0) return false;
      return incoming.every(edgeIsDead);
    }

    for (const node of ordered) {
      if (signal.stopped) break;

      const d     = node.data as Record<string, unknown>;
      const label = (d.label as string) || node.type || node.id;
      const type  = node.type ?? 'script';
      const parents = parentsOf(node.id, edges);

      if (shouldSkip(node.id)) {
        skipped.add(node.id);
        cbs.onLog(`○  [${type}] ${label} — skipped`, 'info');
        results.set(node.id, { id: node.id, label, stdout: '', exitCode: null });
        cbs.onNodeDone(node.id, null);
        continue;
      }

      cbs.onLog(`→  [${type}] ${label}`, 'info');
      cbs.onNodeStart(node.id);

      // Condition: evaluate now, decide branch, log, then fall through with no subprocess.
      if (type === 'condition') {
        const branch = evalCondition(node, results, parents) ? 'true' : 'false';
        liveBranches.set(node.id, branch);
        cbs.onLog(`   ↳ ${branch === 'true' ? '✓ true branch' : '✗ false branch'}`, branch === 'true' ? 'success' : 'warn');
        results.set(node.id, { id: node.id, label, stdout: branch, exitCode: 0 });
        cbs.onNodeDone(node.id, 0);
        continue;
      }

      const handle = execNode(node, settings, cbs.onLog, results, parents);

      if (!handle) {
        if (type === 'trigger') cbs.onLog('   fired', 'info');
        results.set(node.id, { id: node.id, label, stdout: '', exitCode: 0 });
        cbs.onNodeDone(node.id, 0);
        continue;
      }

      stopCurrent = handle.kill;
      const { exitCode, stdout } = await handle.result;
      stopCurrent = null;
      results.set(node.id, { id: node.id, label, stdout, exitCode });
      cbs.onNodeDone(node.id, exitCode);

      if (signal.stopped) break;

      const ok = exitCode === 0 || exitCode === null;
      cbs.onLog(ok ? `   ✓ exit ${exitCode ?? 'ok'}` : `   ✗ exit ${exitCode}`, ok ? 'success' : 'error');

      if (!ok && settings.stopOnError) { flowOk = false; break; }
    }

    if (signal.stopped)  { cbs.onLog('■  Stopped', 'warn');         cbs.onDone(false); }
    else if (flowOk)     { cbs.onLog('✓  Flow complete', 'success'); cbs.onDone(true);  }
    else                 { cbs.onLog('✗  Flow failed', 'error');     cbs.onDone(false); }
  })();

  return { stop };
}

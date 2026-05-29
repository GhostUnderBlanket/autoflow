import { open as openDialog, save as saveDialog, ask } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { Flow } from '../types/flow';
import type { CustomNodeDef } from '../types/customNode';
import { useCustomNodeStore } from '../store/customNodeStore';

const FORMAT_VERSION = 2;

interface FlowExportFile {
  $schema:          'autoflow.flow';
  version:          number;
  exportedAt:       number;
  flow:             Flow;
  /** Custom node definitions referenced by nodes in this flow. */
  customNodeDefs?:  CustomNodeDef[];
}

function safeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '') || 'flow';
}

function collectCustomDefs(flow: Flow): CustomNodeDef[] {
  const store = useCustomNodeStore.getState();
  const defIds = new Set(
    flow.nodes
      .filter(n => n.type === 'custom')
      .map(n => (n.data as Record<string, unknown>).defId as string)
      .filter(Boolean),
  );
  return store.defs.filter(d => defIds.has(d.id));
}

export async function exportFlow(flow: Flow, includeVars?: boolean): Promise<string | null> {
  const withVars = includeVars ?? await ask(
    'Include flow variables in the export?',
    { title: 'Export options', kind: 'info' },
  );
  const target = await saveDialog({
    title:       `Export ${flow.name}`,
    defaultPath: `${safeFileName(flow.name)}.flow.json`,
    filters:     [{ name: 'Autoflow Flow', extensions: ['json'] }],
  });
  if (!target) return null;

  const exportedFlow = withVars
    ? flow
    : { ...flow, variables: Object.fromEntries(Object.keys(flow.variables ?? {}).map(k => [k, ''])) };

  const customNodeDefs = collectCustomDefs(flow);

  const payload: FlowExportFile = {
    $schema:    'autoflow.flow',
    version:    FORMAT_VERSION,
    exportedAt: Date.now(),
    flow:       exportedFlow,
    ...(customNodeDefs.length > 0 && { customNodeDefs }),
  };
  await invoke<void>('write_text_file', {
    opts: { path: target, content: JSON.stringify(payload, null, 2) },
  });
  return target;
}

/**
 * Open a file dialog and return the imported flow(s).
 * Handles both single-flow files ({ $schema: 'autoflow.flow' }) and
 * bundle files ({ $schema: 'autoflow.flows', flows: [...] }).
 * Any embedded customNodeDefs are installed silently.
 */
export async function importFlows(): Promise<Flow[]> {
  const picked = await openDialog({
    multiple: false,
    filters:  [{ name: 'Autoflow Flow / Bundle', extensions: ['json'] }],
    title:    'Import flow(s)',
  });
  if (typeof picked !== 'string' || !picked) return [];

  const text = await invoke<string>('read_text_file', { path: picked });
  return await parseFlowsFile(text);
}

export async function parseFlowsFile(text: string): Promise<Flow[]> {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object') throw new Error('Not a valid flow file.');

  // Bundle: { $schema: 'autoflow.flows', flows: [...] }
  if ((raw as Record<string, unknown>).$schema === 'autoflow.flows') {
    const bundle = raw as { flows?: unknown[]; customNodeDefs?: unknown[] };
    if (!Array.isArray(bundle.flows)) throw new Error('Bundle has no flows array.');
    await installEmbeddedDefs(bundle.customNodeDefs);
    const now = Date.now();
    return bundle.flows.map((item, i) => parseCandidate(item, now + i));
  }

  // Single flow (envelope or bare)
  const envelope = raw as FlowExportFile;
  await installEmbeddedDefs(envelope.customNodeDefs);
  return [parseFlowFile(text)];
}

async function installEmbeddedDefs(defs: unknown[] | undefined): Promise<void> {
  if (!Array.isArray(defs) || defs.length === 0) return;
  const store = useCustomNodeStore.getState();
  const existingIds = new Set(store.defs.map(d => d.id));
  for (const raw of defs) {
    if (!raw || typeof raw !== 'object') continue;
    const def = raw as CustomNodeDef;
    if (!def.id || !def.label || !Array.isArray(def.fields) || !def.executor) continue;
    if (existingIds.has(def.id)) continue; // already installed, don't overwrite
    try { await store.installDef(def); } catch { /* best-effort */ }
  }
}

export function parseFlowFile(text: string): Flow {
  const raw = JSON.parse(text);
  return parseCandidate(
    (raw && typeof raw === 'object' && 'flow' in raw) ? (raw as { flow: unknown }).flow : raw,
    Date.now(),
  );
}

function parseCandidate(candidate: unknown, baseTs: number): Flow {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Not a valid flow object.');
  }
  const c = candidate as Partial<Flow>;
  if (!Array.isArray(c.nodes) || !Array.isArray(c.edges)) {
    throw new Error('Missing nodes/edges arrays.');
  }
  const now = baseTs;
  return {
    id:          `flow-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name:        typeof c.name === 'string' && c.name.trim() ? c.name : 'Imported flow',
    description: typeof c.description === 'string' ? c.description : '',
    variables:   (c.variables && typeof c.variables === 'object' && !Array.isArray(c.variables)) ? c.variables as Record<string, string> : {},
    tags:        Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [],
    nodes:       c.nodes as Flow['nodes'],
    edges:       c.edges as Flow['edges'],
    status:      'idle',
    createdAt:   now,
    updatedAt:   now,
  };
}

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Blocks, Plus, Pencil, Wand2, RefreshCw, FolderOpen, BookOpen,
  Download, Upload, Copy, Trash2, Search, X, Check, Lock,
  Timer, Globe, Terminal, GitBranch, Repeat2, ExternalLink,
  AppWindow, Hourglass, Workflow, Bell, Cpu,
} from 'lucide-react';
import { clsx } from 'clsx';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { useCustomNodeStore } from '../store/customNodeStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { getExampleCustomNodes } from '../lib/exampleCustomNodes';
import { CustomNodeBuilder } from './CustomNodeBuilder';
import type { CustomNodeDef } from '../types/customNode';
import type { ReactNode } from 'react';

/* ─── Built-in node catalogue ──────────────────────────────── */

interface BuiltInDef {
  type:        string;
  label:       string;
  color:       string;
  description: string;
  icon:        ReactNode;
}

const BUILT_IN_NODES: BuiltInDef[] = [
  { type: 'trigger',   label: 'Trigger',    color: '#6d5bef', icon: <Timer size={14} />,       description: 'Starts a flow manually, on a cron schedule, when a file changes, or via webhook.' },
  { type: 'rest',      label: 'REST API',   color: '#f472b6', icon: <Globe size={14} />,        description: 'Makes an HTTP request (GET, POST, PUT, PATCH, DELETE) to any API endpoint.' },
  { type: 'script',    label: 'Script',     color: '#fb923c', icon: <Terminal size={14} />,     description: 'Runs a shell script in cmd, PowerShell, or bash.' },
  { type: 'condition', label: 'Condition',  color: '#00bfff', icon: <GitBranch size={14} />,    description: 'Branches on a true/false test — equals, contains, regex, exit code, and more.' },
  { type: 'loop',      label: 'Loop',       color: '#05c58c', icon: <Repeat2 size={14} />,      description: 'Repeats, retries, or iterates over items with an optional delay between runs.' },
  { type: 'file',      label: 'File',       color: '#fbbf24', icon: <FolderOpen size={14} />,   description: 'Reads, writes, appends to, or checks existence of a local file.' },
  { type: 'openurl',   label: 'Open URL',   color: '#a78bfa', icon: <ExternalLink size={14} />, description: 'Opens a URL in the browser or a file path with its default app.' },
  { type: 'launchapp', label: 'Launch App', color: '#f87171', icon: <AppWindow size={14} />,    description: 'Spawns an executable — fire-and-forget or wait for exit to capture output.' },
  { type: 'delay',     label: 'Delay',      color: '#14b8a6', icon: <Hourglass size={14} />,    description: 'Pauses the flow for N milliseconds, passing upstream stdout through unchanged.' },
  { type: 'subflow',   label: 'Sub-flow',   color: '#818cf8', icon: <Workflow size={14} />,     description: 'Runs another flow inline. Upstream stdout is available as ${var:INPUT}.' },
  { type: 'notify',    label: 'Notify',     color: '#eab308', icon: <Bell size={14} />,         description: 'Sends an OS desktop notification mid-flow with a title and body.' },
  { type: 'envvar',    label: 'Env Var',    color: '#22d3ee', icon: <Cpu size={14} />,          description: 'Gets or sets a process environment variable so child processes can read it.' },
];

/* ─── Checkbox ─────────────────────────────────────────────── */

function Checkbox({ checked, onChange, className }: {
  checked: boolean; onChange: (v: boolean) => void; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      className={clsx(
        'w-[16px] h-[16px] rounded border flex items-center justify-center shrink-0 transition-colors',
        checked
          ? 'bg-accent border-accent'
          : 'border-wire-lit bg-raised hover:border-accent/60',
        className,
      )}
    >
      {checked && <Check size={10} className="text-white" strokeWidth={2.5} />}
    </button>
  );
}

/* ─── NodeCard (custom) ─────────────────────────────────────── */

function NodeCard({
  def, index, selected,
  onToggleSelect, onBuilder, onEditJson,
}: {
  def:            CustomNodeDef;
  index:          number;
  selected:       boolean;
  onToggleSelect: () => void;
  onBuilder:      () => void;
  onEditJson:     () => void;
}) {
  return (
    <div
      onClick={onToggleSelect}
      className={clsx(
        'group flex overflow-hidden rounded-xl border bg-surface',
        'hover:-translate-y-[2px] hover:shadow-xl hover:shadow-black/40',
        'transition-all duration-200 cursor-pointer',
        selected
          ? 'border-accent/50 bg-accent/[.03]'
          : 'border-wire hover:border-wire-lit',
      )}
      style={{
        animation:      'fade-up 0.4s ease both',
        animationDelay: `${index * 55}ms`,
      }}
    >
      <div className="w-[3px] shrink-0" style={{ background: selected ? '#6d5bef' : def.color }} />

      <div className="flex-1 min-w-0 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected}
              onChange={onToggleSelect}
              className={selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            />
            <span className="text-[11px] font-mono text-ink-ghost tracking-widest">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[10.5px] font-mono font-medium"
            style={{ background: `${def.color}18`, color: def.color }}
          >
            <Blocks size={10} />
            {def.executor.type === 'script' ? def.executor.shell : 'JS'}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-ink leading-snug truncate font-display mb-1.5">
            {def.label}
          </h3>
          <p className="text-[12px] text-ink-dim leading-relaxed line-clamp-2">
            {def.description || 'No description.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center px-2 py-[3px] rounded-md text-[10.5px] font-mono bg-raised text-ink-ghost">
            {def.id}{def.version ? ` · v${def.version}` : ''}
          </span>
          <span className="inline-flex items-center px-2 py-[3px] rounded-md text-[10.5px] font-mono bg-raised text-ink-ghost">
            {def.fields.length} field{def.fields.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center justify-end pt-2.5 border-t border-wire mt-auto gap-1">
          <button
            onClick={e => { e.stopPropagation(); onBuilder(); }}
            className="p-1.5 rounded-md text-ink-ghost hover:text-accent-soft hover:bg-accent/10 transition-colors"
            title="Edit in builder"
          >
            <Wand2 size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEditJson(); }}
            className="p-1.5 rounded-md text-ink-ghost hover:text-ink hover:bg-raised transition-colors"
            title="Edit JSON in IDE"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── BuiltInNodeCard ───────────────────────────────────────── */

function BuiltInNodeCard({ def, index }: { def: BuiltInDef; index: number }) {
  return (
    <div
      className="flex overflow-hidden rounded-xl border border-wire bg-surface/60 opacity-80"
      style={{
        animation:      'fade-up 0.4s ease both',
        animationDelay: `${index * 30}ms`,
      }}
    >
      <div className="w-[3px] shrink-0" style={{ background: def.color }} />

      <div className="flex-1 min-w-0 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-ink-ghost tracking-widest">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            className="inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[10.5px] font-mono font-medium"
            style={{ background: `${def.color}14`, color: def.color }}
          >
            {def.icon}
            {def.type}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-ink leading-snug truncate font-display mb-1.5">
            {def.label}
          </h3>
          <p className="text-[12px] text-ink-dim leading-relaxed line-clamp-2">
            {def.description}
          </p>
        </div>

        {/* spacer chip row to match custom card height */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center px-2 py-[3px] rounded-md text-[10.5px] font-mono bg-raised text-ink-ghost">
            {def.type}
          </span>
        </div>

        <div className="flex items-center pt-2.5 border-t border-wire mt-auto">
          <Lock size={10} className="text-ink-ghost/50 mr-1.5" />
          <span className="text-[10.5px] font-mono text-ink-ghost/50">built-in</span>
        </div>
      </div>
    </div>
  );
}

/* ─── NodesPage ─────────────────────────────────────────────── */

export function CustomNodesPage() {
  const { defs, installDef, removeDef, loadDefs } = useCustomNodeStore();
  const wsPath = useWorkspaceStore(s => s.path);

  const [opError,        setOpError]        = useState<string | null>(null);
  const [exBusy,         setExBusy]         = useState(false);
  const [builderOpen,    setBuilderOpen]    = useState(false);
  const [builderInitial, setBuilderInitial] = useState<CustomNodeDef | undefined>(undefined);
  const [search,         setSearch]         = useState('');
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());

  // Search filters both custom and built-in sections
  const filteredCustom = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return defs;
    return defs.filter(d =>
      d.label.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q),
    );
  }, [defs, search]);

  const filteredBuiltIn = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return BUILT_IN_NODES;
    return BUILT_IN_NODES.filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q),
    );
  }, [search]);

  useEffect(() => {
    const validIds = new Set(defs.map(d => d.id));
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [defs]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll  = () => setSelectedIds(new Set(filteredCustom.map(d => d.id)));
  const selectNone = () => setSelectedIds(new Set());
  const allSelected = filteredCustom.length > 0 && filteredCustom.every(d => selectedIds.has(d.id));
  const nSelected   = selectedIds.size;

  function openBuilder(def?: CustomNodeDef) {
    setBuilderInitial(def);
    setBuilderOpen(true);
  }

  async function handleSaveDef(def: CustomNodeDef) {
    await installDef(def);
  }

  async function handleImportExamples() {
    setExBusy(true);
    try {
      const examples = getExampleCustomNodes();
      const existing = new Set(defs.map(d => d.id));
      const toAdd = examples.filter(e => !existing.has(e.id));
      for (const def of toAdd) await installDef(def);
    } catch (e) {
      setOpError(String(e));
    } finally {
      setExBusy(false);
    }
  }

  async function handleImport() {
    setOpError(null);
    try {
      const picked = await openDialog({
        multiple: false,
        filters:  [{ name: 'Custom Node Definition', extensions: ['json'] }],
        title:    'Import custom node',
      });
      if (typeof picked !== 'string' || !picked) return;
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const text = await readTextFile(picked);
      const raw = JSON.parse(text) as CustomNodeDef;
      if (!raw.id || !raw.label || !Array.isArray(raw.fields) || !raw.executor) {
        setOpError('Invalid definition — missing required fields (id, label, fields, executor).');
        return;
      }
      await installDef(raw);
    } catch (e) {
      setOpError(String(e));
    }
  }

  async function handleDuplicateSelected() {
    const allIds = new Set(defs.map(d => d.id));
    for (const id of selectedIds) {
      const def = defs.find(d => d.id === id);
      if (!def) continue;
      let newId = `${id}-copy`;
      let n = 2;
      while (allIds.has(newId)) newId = `${id}-copy-${n++}`;
      allIds.add(newId);
      await installDef({ ...def, id: newId, label: `${def.label} (copy)` });
    }
    selectNone();
  }

  async function handleExportSelected() {
    setOpError(null);
    const selected = defs.filter(d => selectedIds.has(d.id));
    if (selected.length === 0) return;
    try {
      const content = selected.length === 1
        ? JSON.stringify(selected[0], null, 2)
        : JSON.stringify({ customNodeDefs: selected }, null, 2);
      const defaultPath = selected.length === 1
        ? `${selected[0].id}.json`
        : `autoflow-custom-nodes-${new Date().toISOString().slice(0, 10)}.json`;
      const target = await saveDialog({
        title:   selected.length === 1 ? `Export ${selected[0].label}` : `Export ${selected.length} custom nodes`,
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!target) return;
      await invoke('write_text_file', { opts: { path: target, content } });
    } catch (e) {
      setOpError(`Export failed: ${String(e)}`);
    }
  }

  function handleDeleteSelected() {
    const names = defs.filter(d => selectedIds.has(d.id)).map(d => `"${d.label}"`).join(', ');
    if (!confirm(`Delete ${nSelected} node${nSelected !== 1 ? 's' : ''}: ${names}?\n\nThis cannot be undone.`)) return;
    for (const id of [...selectedIds]) void removeDef(id);
    selectNone();
  }

  async function handleEditJson(def: CustomNodeDef) {
    if (!wsPath) return;
    try { await openPath(`${wsPath}/custom-nodes/${def.id}.json`); }
    catch (e) { setOpError(String(e)); }
  }

  const totalCount = defs.length + BUILT_IN_NODES.length;

  return (
    <>
      {builderOpen && (
        <CustomNodeBuilder
          initial={builderInitial}
          onSave={handleSaveDef}
          onClose={() => setBuilderOpen(false)}
        />
      )}

      <div className="h-full flex flex-col dot-grid overflow-hidden">

        {/* Header */}
        <div
          className="flex items-end justify-between px-8 pt-8 pb-6"
          style={{ animation: 'fade-up 0.35s ease both' }}
        >
          <div className="flex items-end gap-4">
            <div>
              <h1 className="text-[21px] font-bold text-ink tracking-tight leading-none font-display">
                Nodes
              </h1>
              <p className="text-[12.5px] text-ink-dim mt-1.5 font-mono">
                {totalCount} total · {defs.length} custom · {BUILT_IN_NODES.length} built-in
              </p>
            </div>

            {defs.length > 0 && (
              <div className="flex items-center gap-2 mb-[3px]">
                <Checkbox
                  checked={allSelected}
                  onChange={v => v ? selectAll() : selectNone()}
                />
                <span className="text-[11.5px] font-mono text-ink-ghost">
                  {nSelected > 0 ? `${nSelected} selected` : 'select all'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {nSelected > 0 && (
              <>
                <button
                  onClick={() => void handleDuplicateSelected()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-wire
                             bg-surface text-ink hover:bg-raised hover:border-wire-lit
                             transition-colors text-[12.5px] font-medium"
                >
                  <Copy size={13} />
                  Duplicate{nSelected > 1 && <span className="ml-0.5 font-mono text-ink-dim">({nSelected})</span>}
                </button>
                <button
                  onClick={() => void handleExportSelected()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-wire
                             bg-surface text-ink hover:bg-raised hover:border-wire-lit
                             transition-colors text-[12.5px] font-medium"
                >
                  <Upload size={13} />
                  Export{nSelected > 1 && <span className="ml-0.5 text-accent-soft font-mono">({nSelected})</span>}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-danger/30
                             bg-danger/[.06] text-danger hover:bg-danger/[.14]
                             transition-colors text-[12.5px] font-medium"
                >
                  <Trash2 size={13} />
                  Delete{nSelected > 1 && <span className="ml-0.5 font-mono">({nSelected})</span>}
                </button>
                <div className="w-px h-5 bg-wire mx-1" />
              </>
            )}

            <button
              onClick={() => void handleImport()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-wire
                         bg-surface text-ink hover:bg-raised hover:border-wire-lit
                         transition-colors text-[12.5px] font-medium"
            >
              <Download size={13} />
              Import
            </button>
            <button
              onClick={() => openBuilder()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white
                         text-[13px] font-semibold hover:bg-accent/90 active:scale-[.97]
                         transition-all shadow-lg shadow-accent/25"
            >
              <Plus size={14} strokeWidth={2.5} />
              New Node
            </button>
          </div>
        </div>

        {opError && (
          <div className="mx-8 mb-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 flex items-start gap-2.5">
            <span className="text-[11.5px] font-mono text-danger flex-1">{opError}</span>
            <button onClick={() => setOpError(null)} className="text-danger/70 hover:text-danger text-[11px] shrink-0">dismiss</button>
          </div>
        )}

        <div className="mx-8 h-px bg-wire" />

        {/* Filter bar */}
        <div className="px-8 py-3 flex items-center gap-3 border-b border-wire/60">
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-ghost pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search nodes…"
              spellCheck={false}
              className="pl-8 pr-8 py-[5px] rounded-md bg-raised border border-wire text-ink
                         text-[11.5px] placeholder-ink-ghost w-[220px]
                         focus:outline-none focus:border-wire-lit transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-ghost hover:text-ink">
                <X size={11} />
              </button>
            )}
          </div>

          <button
            onClick={() => void handleImportExamples()}
            disabled={exBusy}
            className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-md border border-wire
                       bg-surface text-ink-dim hover:text-ink hover:bg-raised hover:border-wire-lit
                       transition-colors text-[11.5px] font-medium disabled:opacity-40"
            title={`Import ${getExampleCustomNodes().length} example custom nodes`}
          >
            <BookOpen size={12} />
            Examples
          </button>
          <button
            onClick={() => void loadDefs()}
            className="p-[6px] rounded-md border border-wire bg-surface text-ink-ghost
                       hover:text-ink hover:bg-raised hover:border-wire-lit transition-colors"
            title="Reload custom nodes from disk"
          >
            <RefreshCw size={12} />
          </button>
          {wsPath && (
            <button
              onClick={() => void openPath(`${wsPath}/custom-nodes`).catch(() => {})}
              className="p-[6px] rounded-md border border-wire bg-surface text-ink-ghost
                         hover:text-ink hover:bg-raised hover:border-wire-lit transition-colors"
              title="Open custom-nodes folder"
            >
              <FolderOpen size={12} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6 space-y-8">

          {/* Custom nodes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-ink-ghost">
                Custom · {filteredCustom.length}
              </p>
            </div>

            {filteredCustom.length === 0 ? (
              <div className={clsx(
                'rounded-xl border border-wire/60 border-dashed px-5 py-8 text-center',
                search ? '' : 'bg-raised/20',
              )}>
                {search ? (
                  <p className="text-[12.5px] text-ink-ghost">No custom nodes match the search.</p>
                ) : (
                  <>
                    <Blocks size={20} className="text-ink-ghost mx-auto mb-2 opacity-40" />
                    <p className="text-[12.5px] text-ink-dim font-medium">No custom nodes installed.</p>
                    <p className="text-[11.5px] text-ink-ghost mt-1 mb-4">
                      Click <span className="font-mono">New Node</span> to build one, or import a <span className="font-mono">.json</span> definition.
                    </p>
                    <button
                      onClick={() => openBuilder()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/25
                                 text-accent-soft text-[12px] font-medium hover:bg-accent/18 transition-colors"
                    >
                      <Plus size={12} strokeWidth={2.5} />
                      New Node
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredCustom.map((def, i) => (
                  <NodeCard
                    key={def.id}
                    def={def}
                    index={i}
                    selected={selectedIds.has(def.id)}
                    onToggleSelect={() => toggleSelect(def.id)}
                    onBuilder={() => openBuilder(def)}
                    onEditJson={() => void handleEditJson(def)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Built-in nodes */}
          <section>
            <p className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-ink-ghost mb-3">
              Built-in · {filteredBuiltIn.length}
            </p>

            {filteredBuiltIn.length === 0 ? (
              <p className="text-[12.5px] text-ink-ghost text-center py-4">No built-in nodes match the search.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredBuiltIn.map((def, i) => (
                  <BuiltInNodeCard key={def.type} def={def} index={i} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

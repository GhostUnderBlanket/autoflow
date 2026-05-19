import { useMemo, useState } from 'react';
import {
  ScrollText, ChevronDown, ChevronRight, Trash2, Timer, Sparkle, Clock, Upload, Search, X, ExternalLink,
} from 'lucide-react';
import { useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Select } from './ui/Select';
import { useRunLogStore, type RunSession } from '../store/runLogStore';
import { useFlowStore } from '../store/flowStore';

/* ─── Helpers ──────────────────────────────────── */

function ago(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000)     return 'just now';
  if (d < 3_600_000)  return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ts).toLocaleTimeString();
}

function duration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start;
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function dayLabel(key: string): string {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  if (key === today)     return 'Today';
  if (key === yesterday) return 'Yesterday';
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
}

const LEVEL_COLOR: Record<string, string> = {
  info:    'text-ink-dim',
  success: 'text-success',
  error:   'text-danger',
  warn:    'text-amber-400',
};

const STATUS_DOT: Record<string, string> = {
  running: 'bg-blue-400',
  success: 'bg-success',
  error:   'bg-danger',
};

const TRIGGER_ICON = {
  manual:     <Sparkle size={11} />,
  cron:       <Timer size={11} />,
  'catch-up': <Clock size={11} />,
} as const;

type StatusFilter  = 'all' | 'running' | 'success' | 'error';
type TriggerFilter = 'all' | 'manual' | 'cron' | 'catch-up';

const STATUS_OPTIONS  = [
  { value: 'all',     label: 'All statuses' },
  { value: 'running', label: 'Running'      },
  { value: 'success', label: 'Success'      },
  { value: 'error',   label: 'Error'        },
];
const TRIGGER_OPTIONS = [
  { value: 'all',      label: 'All triggers' },
  { value: 'manual',   label: 'Manual'       },
  { value: 'cron',     label: 'Cron'         },
  { value: 'catch-up', label: 'Catch-up'     },
];

/* ─── SessionRow ───────────────────────────────── */

function SessionRow({ session, highlight = false }: { session: RunSession; highlight?: boolean }) {
  const [open, setOpen] = useState(session.status === 'running' || highlight);
  const { setActiveFlow, setView, setTargetSession } = useFlowStore();
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight || !rowRef.current) return;
    // Delay so the page layout is complete, then only scroll if the row
    // isn't already fully visible (block: nearest = no-op when in view).
    const t = setTimeout(() => {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTargetSession(null);
    }, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpToFlow() {
    setActiveFlow(session.flowId);
    setView('editor');
  }

  const dot = STATUS_DOT[session.status] ?? 'bg-ink-ghost';
  const isRunning = session.status === 'running';

  return (
    <div ref={rowRef} className="border border-wire rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-raised/60 transition-colors text-left"
      >
        <span className="text-ink-ghost shrink-0">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>

        <span
          className={clsx('w-2 h-2 rounded-full shrink-0', dot)}
          style={isRunning ? { animation: 'pulse-dot 1.4s ease-in-out infinite' } : undefined}
        />

        <span className="flex-1 text-[13px] font-semibold text-ink truncate font-display">
          {session.flowName}
        </span>

        <span className="flex items-center gap-1 text-[10.5px] font-mono text-ink-ghost shrink-0">
          {TRIGGER_ICON[session.trigger]}
          {session.trigger}
        </span>

        <span className="text-[11px] font-mono text-ink-ghost shrink-0 w-14 text-right">
          {duration(session.startedAt, session.finishedAt)}
        </span>

        <span className="text-[11px] font-mono text-ink-ghost shrink-0 w-20 text-right">
          {ago(session.startedAt)}
        </span>

        <span
          role="button"
          onClick={e => { e.stopPropagation(); jumpToFlow(); }}
          title="Open flow in editor"
          className="shrink-0 p-1 rounded-md text-ink-ghost hover:text-ink hover:bg-raised transition-colors"
        >
          <ExternalLink size={12} />
        </span>
      </button>

      {open && (
        <div className="border-t border-wire bg-canvas/60 px-4 py-3 font-mono text-[11.5px] space-y-[3px] max-h-[360px] overflow-auto">
          {session.logs.length === 0 ? (
            <p className="text-ink-ghost italic">no output yet</p>
          ) : (
            session.logs.map(log => (
              <div key={log.id} className="flex gap-3 items-start leading-relaxed">
                <span className="text-ink-ghost/60 shrink-0 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={clsx('flex-1 break-all whitespace-pre-wrap', LEVEL_COLOR[log.level] ?? 'text-ink-dim')}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          {isRunning && (
            <div className="flex items-center gap-1.5 text-ink-ghost mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
              running…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── RunLogPage ───────────────────────────────── */

export function RunLogPage() {
  const sessions        = useRunLogStore(s => s.sessions);
  const targetSessionId = useFlowStore(s => s.targetSessionId);
  const clear    = useRunLogStore(s => s.clear);

  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');
  const [search,        setSearch]        = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sessions.filter(s => {
      if (statusFilter  !== 'all' && s.status  !== statusFilter)  return false;
      if (triggerFilter !== 'all' && s.trigger !== triggerFilter) return false;
      if (needle) {
        const inName = s.flowName.toLowerCase().includes(needle);
        const inLog  = s.logs.some(l => l.message.toLowerCase().includes(needle));
        if (!inName && !inLog) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, triggerFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, RunSession[]>();
    for (const s of filtered) {
      const key = dayKey(s.startedAt);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  async function handleExport() {
    if (filtered.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      const target = await saveDialog({
        defaultPath: `autoflow-runlog-${stamp}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!target) return;
      const payload = JSON.stringify({
        $schema:    'autoflow.runlog',
        version:    1,
        exportedAt: Date.now(),
        filters:    { statusFilter, triggerFilter, search },
        sessions:   filtered,
      }, null, 2);
      await invoke('write_text_file', { opts: { path: target, content: payload } });
    } catch (e) {
      window.alert(`Export failed: ${String(e)}`);
    }
  }

  const totalCount    = sessions.length;
  const filteredCount = filtered.length;
  const isFiltered    = filteredCount !== totalCount;

  return (
    <div className="h-full flex flex-col dot-grid overflow-hidden">

      {/* Header */}
      <div
        className="flex items-end justify-between px-8 pt-8 pb-6"
        style={{ animation: 'fade-up 0.35s ease both' }}
      >
        <div>
          <h1 className="text-[21px] font-bold text-ink tracking-tight leading-none font-display">
            Run Log
          </h1>
          <p className="text-[12.5px] text-ink-dim mt-1.5 font-mono">
            {isFiltered
              ? `${filteredCount} of ${totalCount} session${totalCount !== 1 ? 's' : ''}`
              : `${totalCount} session${totalCount !== 1 ? 's' : ''}`}
            {' · most recent first'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={filteredCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-wire
                       text-ink-dim hover:text-ink hover:border-wire-lit
                       text-[12px] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export current view as JSON"
          >
            <Upload size={12} />
            Export
          </button>
          {sessions.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Clear all run history?')) clear(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-wire
                         text-ink-ghost hover:text-danger hover:border-danger/30 hover:bg-danger/5
                         text-[12px] transition-all"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mx-8 h-px bg-wire" />

      {/* Filter bar */}
      {sessions.length > 0 && (
        <div className="px-8 py-3 flex items-center gap-3 border-b border-wire">
          <div className="w-[150px]">
            <Select value={statusFilter}  options={STATUS_OPTIONS}  onChange={v => setStatusFilter(v as StatusFilter)} />
          </div>
          <div className="w-[150px]">
            <Select value={triggerFilter} options={TRIGGER_OPTIONS} onChange={v => setTriggerFilter(v as TriggerFilter)} />
          </div>
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-ghost pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search name or log…"
              spellCheck={false}
              className="pl-8 pr-7 py-[5px] rounded-md bg-raised border border-wire text-ink
                         text-[11.5px] placeholder-ink-ghost focus:outline-none focus:border-wire-lit w-[220px]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-ghost hover:text-ink">
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-16">
            <div
              className="w-[52px] h-[52px] rounded-2xl bg-surface border border-wire
                         flex items-center justify-center mb-5"
              style={{ animation: 'fade-up 0.4s ease both' }}
            >
              <ScrollText size={22} className="text-ink-ghost" />
            </div>
            <h3 className="text-[15px] font-semibold text-ink mb-2 font-display">No runs yet</h3>
            <p className="text-[13px] text-ink-dim text-center max-w-[256px] leading-relaxed">
              Run a flow manually or wait for a cron trigger — each execution will appear here.
            </p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-16">
            <p className="text-[13px] text-ink-dim font-mono">
              No sessions match the current filters.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([key, list]) => (
              <div key={key}>
                <div className="flex items-baseline gap-3 mb-2.5">
                  <h3 className="text-[12px] font-semibold text-ink-dim tracking-wide font-display">
                    {dayLabel(key)}
                  </h3>
                  <span className="text-[10px] font-mono text-ink-ghost">
                    {list.length} session{list.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-wire/70" />
                </div>
                <div className="space-y-2.5">
                  {list.map(s => <SessionRow key={s.id} session={s} highlight={s.id === targetSessionId} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

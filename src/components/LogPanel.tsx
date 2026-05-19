import { ChevronUp, ChevronDown, Trash2, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types/flow';

interface LogPanelProps {
  open:     boolean;
  onToggle: () => void;
  logs:     LogEntry[];
  onClear:  () => void;
}

const LEVEL = {
  info:    { glyph: '·', cls: 'text-ink-dim'   },
  success: { glyph: '✓', cls: 'text-success'   },
  error:   { glyph: '✗', cls: 'text-danger'    },
  warn:    { glyph: '!', cls: 'text-[#f59e0b]' },
} as const;

function ts(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function LogPanel({ open, onToggle, logs, onClear }: LogPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, open]);

  async function handleCopy() {
    const text = logs.map(e => {
      const t = ts(e.timestamp);
      const g = LEVEL[e.level].glyph;
      return `[${t}] ${g} ${e.message}`;
    }).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div
      className="shrink-0 border-t border-wire bg-canvas flex flex-col overflow-hidden transition-all duration-200"
      style={{ height: open ? 220 : 30 }}
    >
      {/* Toggle bar */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 h-[30px] shrink-0
                   hover:bg-raised/50 transition-colors group"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={11} className="text-ink-ghost" /> : <ChevronUp size={11} className="text-ink-ghost" />}
          <span className="text-[10.5px] font-mono text-ink-dim group-hover:text-ink transition-colors">
            run log
          </span>
          {logs.length > 0 && (
            <span className="text-[9.5px] font-mono text-ink-ghost px-1.5 py-0.5 rounded bg-raised border border-wire">
              {logs.length}
            </span>
          )}
        </div>
        {open && logs.length > 0 && (
          <div className="flex items-center gap-3">
            <div
              role="button"
              onClick={e => { e.stopPropagation(); handleCopy(); }}
              className={clsx(
                'flex items-center gap-1 text-[9.5px] font-mono transition-colors',
                copied ? 'text-success' : 'text-ink-ghost hover:text-ink-dim',
              )}
            >
              {copied ? <Check size={9} /> : <Copy size={9} />}
              {copied ? 'copied' : 'copy'}
            </div>
            <div
              role="button"
              onClick={e => { e.stopPropagation(); onClear(); }}
              className="flex items-center gap-1 text-[9.5px] font-mono text-ink-ghost
                         hover:text-ink-dim transition-colors"
            >
              <Trash2 size={9} />
              clear
            </div>
          </div>
        )}
      </button>

      {/* Log body */}
      {open && (
        <div className="flex-1 overflow-auto px-4 pb-2">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-[10.5px] font-mono text-ink-ghost">
                run a flow to see output
              </span>
            </div>
          ) : (
            <div className="space-y-px">
              {logs.map(entry => {
                const l = LEVEL[entry.level];
                return (
                  <div key={entry.id} className="flex items-start gap-3 py-px">
                    <span className="text-[10px] font-mono text-ink-ghost shrink-0 tabular-nums select-none">
                      {ts(entry.timestamp)}
                    </span>
                    <span className={clsx('text-[10px] font-mono shrink-0 w-3 text-center select-none', l.cls)}>
                      {l.glyph}
                    </span>
                    <span className={clsx('text-[11px] font-mono leading-relaxed break-all', l.cls)}>
                      {entry.message}
                    </span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

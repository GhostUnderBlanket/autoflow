import { useState } from 'react';
import { Braces, Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface VarRow { key: string; value: string }

interface FlowVarsPanelProps {
  variables: VarRow[];
  onChange:  (v: VarRow[]) => void;
}

export function FlowVarsPanel({ variables, onChange }: FlowVarsPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function update(i: number, patch: Partial<VarRow>) {
    onChange(variables.map((v, j) => j === i ? { ...v, ...patch } : v));
  }

  function addVar() {
    const next = [...variables, { key: '', value: '' }];
    onChange(next);
    setExpandedIdx(next.length - 1);
  }

  function removeVar(i: number) {
    onChange(variables.filter((_, j) => j !== i));
    setExpandedIdx(idx => idx === i ? null : idx !== null && idx > i ? idx - 1 : idx);
  }

  function toggleExpand(i: number) {
    setExpandedIdx(idx => idx === i ? null : i);
  }

  const defined = variables.filter(v => v.key.trim()).length;

  return (
    <aside
      className="w-[300px] shrink-0 flex flex-col bg-surface border-l border-wire overflow-hidden"
      style={{ animation: 'slide-in-right 0.2s ease both' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-wire shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-accent-soft"><Braces size={13} /></span>
          <span className="text-[13px] font-semibold font-display text-ink">Flow Variables</span>
        </div>
        <span className="text-[10.5px] font-mono text-ink-ghost">
          {defined > 0 ? `${defined} defined` : 'none'}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {variables.length === 0 && (
          <p className="px-4 py-5 text-[12px] text-ink-ghost italic">
            No variables yet — click below to add one.
          </p>
        )}

        {variables.map((v, i) => {
          const isOpen = expandedIdx === i;
          const hasKey = v.key.trim().length > 0;
          return (
            <div key={i} className="border-b border-wire/60 last:border-0">
              <button
                onClick={() => toggleExpand(i)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-raised/50 transition-colors text-left"
              >
                <span className="text-ink-ghost shrink-0">
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <span className={clsx(
                  'text-[12px] font-mono font-semibold flex-1 min-w-0 truncate',
                  hasKey ? 'text-accent-soft' : 'text-ink-ghost italic',
                )}>
                  {hasKey ? v.key : 'unnamed'}
                </span>
                {!isOpen && (
                  <span className="text-[11px] font-mono text-ink-ghost truncate max-w-[90px] shrink-0">
                    {v.value || <span className="opacity-40">empty</span>}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2.5" style={{ animation: 'fade-up 0.15s ease both' }}>
                  <div>
                    <label className="block text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-dim mb-1">
                      Name
                    </label>
                    <input
                      autoFocus
                      value={v.key}
                      onChange={e => update(i, { key: e.target.value.replace(/\s/g, '_').toUpperCase() })}
                      placeholder="VARIABLE_NAME"
                      spellCheck={false}
                      className="w-full px-2.5 py-1.5 rounded-md bg-raised border border-wire text-ink
                                 text-[11.5px] font-mono placeholder-ink-ghost
                                 focus:outline-none focus:border-wire-lit transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-dim mb-1">
                      Value
                    </label>
                    <input
                      value={v.value}
                      onChange={e => update(i, { value: e.target.value })}
                      placeholder="value"
                      spellCheck={false}
                      className="w-full px-2.5 py-1.5 rounded-md bg-raised border border-wire text-ink
                                 text-[11.5px] font-mono placeholder-ink-ghost
                                 focus:outline-none focus:border-wire-lit transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => removeVar(i)}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-ink-ghost
                               hover:text-danger transition-colors"
                  >
                    <Trash2 size={11} />
                    Delete variable
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={addVar}
          className="w-full flex items-center gap-2 px-4 py-3 text-ink-dim
                     hover:text-ink hover:bg-raised/40 transition-colors
                     text-[12px] font-mono border-b border-wire/60"
        >
          <Plus size={12} />
          Add variable
        </button>
      </div>

      <div className="px-4 py-3 border-t border-wire shrink-0">
        <p className="text-[10px] font-mono text-ink-ghost leading-relaxed">
          Use <span className="text-ink-dim">{'${var:NAME}'}</span> in any node field,
          or pick from <span className="text-accent-soft">Insert ref</span> in a field.
        </p>
      </div>
    </aside>
  );
}

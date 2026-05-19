import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Link2, AlertTriangle, Braces } from 'lucide-react';
import { clsx } from 'clsx';
import type { UpstreamRef } from '../../lib/graphRefs';
import { resolveRefs } from '../../lib/graphRefs';

interface RefFieldProps {
  value:    string;
  onChange: (v: string) => void;
  upstream: UpstreamRef[];
  /** When true the value is rendered in a small textarea; otherwise single-line input. */
  multiline?:   boolean;
  placeholder?: string;
  rows?:        number;
}

type Modifier = 'stdout' | 'exit';

/**
 * A text field with a "+ Insert" button that opens a picker of upstream
 * node outputs. The picker inserts a `${id}` (or `${id.exit}`) placeholder
 * at the cursor position. Below the field we render a friendly "References:"
 * row that decodes any placeholders into their node labels — so the user
 * sees both the raw token (in the field) and what it means (under the field).
 */
export function RefField({
  value, onChange, upstream, multiline = false, placeholder, rows = 5,
}: RefFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r          = btnRef.current.getBoundingClientRect();
    const W          = 280;
    const margin     = 8;
    const winW       = window.innerWidth;
    const winH       = window.innerHeight;
    const spaceBelow = winH - r.bottom - margin;
    const spaceAbove = r.top - margin;
    // Estimate the popover's preferred height from its content: per row ~58px,
    // plus ~74px of chrome (header + footer). Cap at 420.
    const preferred  = Math.min(420, 74 + upstream.length * 58);
    // Flip up whenever there's not enough room below AND more room above.
    const flipUp     = spaceBelow < preferred && spaceAbove > spaceBelow;
    const maxHeight  = Math.max(160, Math.min(preferred, flipUp ? spaceAbove : spaceBelow));
    const left       = Math.min(Math.max(margin, r.left), winW - W - margin);
    const top        = flipUp ? r.top - maxHeight - 6 : r.bottom + 6;
    setPos({ top, left, maxHeight });
  }, [open, upstream.length]);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-ref-picker]') && !t.closest('[data-ref-picker-btn]')) {
        setOpen(false);
      }
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onScroll(e: Event) {
      // Ignore scrolls inside the popover itself — that's the user
      // scrolling through the list and shouldn't close it.
      const t = e.target as HTMLElement | null;
      if (t && t.nodeType === 1 && t.closest && t.closest('[data-ref-picker]')) return;
      setOpen(false);
    }
    function onResize() { setOpen(false); }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  function insertAtCursor(token: string) {
    const el = inputRef.current;
    if (!el) {
      onChange((value ?? '') + token);
      setOpen(false);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    setOpen(false);
    // Restore cursor after the inserted token.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function tokenFor(ref: UpstreamRef, mod: Modifier): string {
    return mod === 'exit' ? `\${${ref.id}.exit}` : `\${${ref.id}}`;
  }

  const resolved = resolveRefs(value ?? '', upstream);
  const sharedFieldClass = clsx(
    'w-full px-2.5 py-2 rounded-md bg-raised border border-wire text-ink',
    'text-[12px] placeholder-ink-ghost',
    'focus:outline-none focus:border-wire-lit transition-colors',
    multiline && 'font-mono leading-relaxed resize-none',
  );

  return (
    <div>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={sharedFieldClass}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(sharedFieldClass, 'font-mono')}
        />
      )}

      {/* Insert + resolved references row */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <button
          ref={btnRef}
          type="button"
          data-ref-picker-btn
          onClick={() => setOpen(v => !v)}
          disabled={upstream.length === 0}
          className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors',
            upstream.length === 0
              ? 'text-ink-ghost/50 cursor-not-allowed'
              : 'text-accent-soft bg-accent/[.08] hover:bg-accent/[.18] border border-accent/30',
          )}
          title={upstream.length === 0
            ? 'Connect a node upstream to enable input references'
            : 'Insert a reference to upstream node output'}
        >
          <Braces size={10} />
          Insert ref
        </button>

        {resolved.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {resolved.map((r, i) => (
              <ResolvedChip key={`${r.raw}-${i}`} ref_={r} />
            ))}
          </div>
        )}
      </div>

      {/* Picker portal */}
      {open && pos && createPortal(
        <div
          data-ref-picker
          className="fixed z-[60] bg-surface border border-wire rounded-lg shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
          style={{
            top:       pos.top,
            left:      pos.left,
            width:     280,
            maxHeight: pos.maxHeight,
            animation: 'fade-down 0.12s ease both',
          }}
        >
          <div className="px-3 py-2 border-b border-wire shrink-0">
            <div className="text-[10.5px] font-mono tracking-[0.12em] uppercase text-ink-dim">
              Insert reference to…
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {upstream.map((u, i) => (
              <PickerRow
                key={u.id}
                index={i}
                ref_={u}
                onPickStdout={() => insertAtCursor(tokenFor(u, 'stdout'))}
                onPickExit={()   => insertAtCursor(tokenFor(u, 'exit'))}
              />
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-wire bg-raised/40 shrink-0">
            <p className="text-[10px] text-ink-ghost leading-relaxed">
              Tip: <span className="font-mono">stdout</span> is whatever the node printed; <span className="font-mono">exit</span> is its exit code.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ─── Internals ───────────────────────────────────────────── */

function PickerRow({
  index, ref_, onPickStdout, onPickExit,
}: {
  index: number;
  ref_: UpstreamRef;
  onPickStdout: () => void;
  onPickExit:   () => void;
}) {
  return (
    <div
      className="group px-3 py-2 hover:bg-raised/60 transition-colors"
      style={{ animation: `fade-up 0.18s ${index * 25}ms ease both` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[12.5px] font-medium text-ink truncate" title={ref_.label}>
          {ref_.label}
        </div>
        <span className="text-[9px] font-mono tracking-wider uppercase text-ink-ghost shrink-0">
          {ref_.type}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPickStdout}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono
                     bg-accent/[.08] hover:bg-accent/[.18] text-accent-soft border border-accent/25 transition-colors"
        >
          <ChevronRight size={9} />
          stdout
        </button>
        <button
          type="button"
          onClick={onPickExit}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono
                     text-ink-dim hover:text-ink hover:bg-raised border border-wire transition-colors"
        >
          <ChevronRight size={9} />
          exit
        </button>
      </div>
    </div>
  );
}

function ResolvedChip({ ref_ }: { ref_: ReturnType<typeof resolveRefs>[number] }) {
  const known = !!ref_.matched;
  return (
    <span
      title={known
        ? `${ref_.raw} → ${ref_.matched!.label}${ref_.modifier !== 'stdout' ? ` (${ref_.modifier})` : ''}`
        : `${ref_.raw} → unresolved (no upstream node with that id)`}
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[10px] font-mono border',
        known
          ? 'bg-accent/[.10] text-accent-soft border-accent/30'
          : 'bg-danger/[.10] text-danger border-danger/30',
      )}
    >
      {known ? <Link2 size={9} /> : <AlertTriangle size={9} />}
      <span className="max-w-[120px] truncate">
        {known ? ref_.matched!.label : ref_.baseKey}
      </span>
      {ref_.modifier !== 'stdout' && (
        <span className="text-ink-ghost">·{ref_.modifier}</span>
      )}
    </span>
  );
}

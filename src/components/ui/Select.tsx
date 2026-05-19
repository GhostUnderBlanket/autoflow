import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value:        string;
  label:        string;
  description?: string;
}

interface SelectProps {
  value:        string;
  options:      SelectOption[];
  onChange:     (v: string) => void;
  placeholder?: string;
  mono?:        boolean;
  emptyHint?:   string;        // shown when options list is empty
  showClear?:   boolean;
}

export function Select({
  value, options, onChange, placeholder = 'Select…', mono = false, emptyHint, showClear = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      const popup = document.getElementById('select-popup');
      if (popup?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const label    = selected?.label ?? (value ? value : placeholder);
  const isEmpty  = !selected && !value;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md',
          'bg-raised border text-[12px] transition-colors',
          'focus:outline-none',
          open ? 'border-wire-lit' : 'border-wire hover:border-wire-lit',
          isEmpty ? 'text-ink-ghost' : 'text-ink',
          mono && 'font-mono',
        )}
      >
        <span className="truncate text-left">{label}</span>
        <ChevronDown size={13} className={clsx('shrink-0 text-ink-dim transition-transform', open && 'rotate-180')} />
      </button>

      {open && rect && createPortal(
        <div
          id="select-popup"
          className="fixed z-[120] rounded-md border border-wire-lit bg-surface shadow-2xl shadow-black/60 overflow-hidden"
          style={{
            left:      rect.left,
            top:       rect.bottom + 4,
            width:     rect.width,
            maxHeight: 280,
            animation: 'fade-down 0.12s ease both',
          }}
        >
          <div className="max-h-[280px] overflow-y-auto py-1">
            {showClear && value && (
              <SelectItem
                onClick={() => { onChange(''); setOpen(false); }}
                selected={false}
                mono={mono}
                label="— clear —"
                muted
              />
            )}
            {options.length === 0 ? (
              <div className="px-3 py-3 text-[11.5px] text-ink-ghost italic">
                {emptyHint ?? 'No options'}
              </div>
            ) : (
              options.map(o => (
                <SelectItem
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  selected={o.value === value}
                  mono={mono}
                  label={o.label}
                  description={o.description}
                />
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function SelectItem({
  onClick, selected, mono, label, description, muted = false,
}: {
  onClick: () => void;
  selected: boolean;
  mono?: boolean;
  label: string;
  description?: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full flex items-start gap-2 px-3 py-2 text-left transition-colors',
        'hover:bg-raised',
        selected ? 'bg-accent/[.10] text-accent-soft' : muted ? 'text-ink-ghost' : 'text-ink',
      )}
    >
      <span className={clsx('flex-1 min-w-0', mono && 'font-mono')}>
        <span className={clsx('text-[12.5px] truncate block', selected && 'font-semibold')}>
          {label}
        </span>
        {description && (
          <span className="text-[10.5px] text-ink-ghost mt-0.5 truncate block font-sans">
            {description}
          </span>
        )}
      </span>
      {selected && <Check size={12} className="mt-[3px] shrink-0 text-accent-soft" />}
    </button>
  );
}

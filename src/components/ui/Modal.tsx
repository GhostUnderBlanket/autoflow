import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open:     boolean;
  onClose:  () => void;
  title:    string;
  subtitle?: string;
  width?:   number;
  children: ReactNode;
  footer?:  ReactNode;
}

export function Modal({ open, onClose, title, subtitle, width = 480, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-6"
      style={{ animation: 'fade-in 0.15s ease both' }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <div
        className="relative rounded-xl border border-wire bg-surface shadow-2xl shadow-black/50 overflow-hidden"
        style={{ width, animation: 'slide-down 0.18s ease both' }}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-wire">
          <div>
            <h2 className="text-[14px] font-semibold font-display text-ink leading-tight">{title}</h2>
            {subtitle && (
              <p className="text-[11.5px] text-ink-dim mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 -mr-1 rounded-md text-ink-ghost hover:text-ink hover:bg-raised transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-wire flex items-center justify-end gap-2 bg-raised/30">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, X, ScrollText } from 'lucide-react';
import { clsx } from 'clsx';
import { useToastStore, type Toast } from '../store/toastStore';
import { useFlowStore } from '../store/flowStore';

const AUTO_DISMISS_MS = 10_000;

function fmt(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`;
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove          = useToastStore(s => s.remove);
  const setView         = useFlowStore(s => s.setView);
  const setTargetSession = useFlowStore(s => s.setTargetSession);
  const ok              = toast.kind === 'success';

  useEffect(() => {
    const t = setTimeout(() => remove(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast.id, remove]);

  function viewLogs() {
    setTargetSession(toast.sessionId);
    setView('runlog');
    remove(toast.id);
  }

  return (
    <div
      className={clsx(
        'flex items-start gap-3 w-[300px] rounded-xl border px-4 py-3',
        'shadow-2xl shadow-black/50 bg-surface',
        ok ? 'border-success/30' : 'border-danger/30',
      )}
      style={{ animation: 'slide-in-right 0.22s ease both' }}
    >
      <span className={clsx('shrink-0 mt-[1px]', ok ? 'text-success' : 'text-danger')}>
        {ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-ink truncate font-display">
          {toast.flowName}
        </p>
        <p className={clsx('text-[11px] font-mono mt-0.5', ok ? 'text-success' : 'text-danger')}>
          {ok ? 'Completed' : 'Failed'} · {fmt(toast.durationMs)}
        </p>
        <button
          onClick={viewLogs}
          className="flex items-center gap-1 text-[10.5px] font-mono text-ink-ghost
                     hover:text-ink-dim transition-colors mt-1.5"
        >
          <ScrollText size={10} />
          View logs
        </button>
      </div>

      <button
        onClick={() => remove(toast.id)}
        className="shrink-0 p-0.5 text-ink-ghost hover:text-ink transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2.5 items-end">
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>,
    document.body,
  );
}

import { useEffect, useState } from 'react';
import {
  Zap, FolderOpen, ArrowRight, ExternalLink, Archive,
  BookOpen, SkipForward, Check,
} from 'lucide-react';
import { clsx } from 'clsx';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useWorkspaceStore } from '../store/workspaceStore';
import { getExampleFlows } from '../lib/exampleFlows';
import { saveFlowNow } from '../lib/flowPersistence';

type Step = 'workspace' | 'examples';

const EXAMPLE_HIGHLIGHTS = [
  'Hello World — your first flow',
  'Cron Trigger — runs on a schedule',
  'REST API — GET & POST with a free public API',
  'Condition Branch — true / false routing',
  'Flow Variables — ${var:NAME} interpolation',
  'Node References — pass data between nodes',
  'JSON Field Extraction — ${node.field} dot notation',
  'File — write, check exists, read, append',
  'Open URL — launch browser or local file',
  'Loop — repeat, retry on error, forEach (lines & JSON)',
];

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { set, suggested, legacySummary, migrateLegacy } = useWorkspaceStore();

  const [step,      setStep]      = useState<Step>('workspace');
  const [path,      setPath]      = useState('');
  const [legacy,    setLegacy]    = useState<{ flows: number; root: string } | null>(null);
  const [doMigrate, setDoMigrate] = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    suggested().then(setPath).catch(() => setPath(''));
    legacySummary().then(s => {
      if (s.flows > 0) setLegacy(s);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmWorkspace() {
    setError(null);
    if (!path.trim()) { setError('Pick a work directory.'); return; }
    setBusy(true);
    try {
      await set(path.trim());
      if (legacy && doMigrate) {
        try { await migrateLegacy(); } catch (e) { console.warn('[welcome] migration failed:', e); }
      }
      setStep('examples');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function browse() {
    setError(null);
    try {
      const picked = await openDialog({ directory: true, multiple: false, defaultPath: path || undefined, title: 'Pick a work directory' });
      if (typeof picked === 'string' && picked) setPath(picked);
    } catch (e) { setError(String(e)); }
  }

  async function importAndContinue() {
    setBusy(true);
    try {
      const flows = getExampleFlows();
      await Promise.all(flows.map(f => saveFlowNow(f)));
    } catch (e) {
      setError(String(e));
      setBusy(false);
      return;
    }
    setBusy(false);
    onDone();
  }

  return (
    <div className="h-full flex items-center justify-center bg-canvas dot-grid overflow-auto">
      <div
        className="w-[520px] max-w-[92vw] rounded-2xl border border-wire bg-surface
                   shadow-2xl shadow-black/40 overflow-hidden"
        style={{ animation: 'fade-up 0.4s ease both' }}
      >
        {step === 'workspace' ? (
          <>
            {/* Header */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-[36px] h-[36px] rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
                  <Zap size={18} strokeWidth={2.5} className="text-white" fill="white" />
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-accent-soft">Welcome</div>
                  <div className="text-[18px] font-bold font-display text-ink leading-tight">Pick your work directory</div>
                </div>
              </div>
              <p className="text-[12.5px] text-ink-dim leading-relaxed">
                One folder for your <span className="font-mono">flows/</span>. Pick a location you can back up, sync, or version-control.
                You can change it later in Settings.
              </p>
            </div>

            <div className="h-px bg-wire mx-7" />

            {/* Path picker */}
            <div className="px-7 py-5 space-y-3">
              <label className="block text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-dim">
                Work Directory
              </label>
              <div className="flex items-center gap-2">
                <input
                  value={path}
                  onChange={e => setPath(e.target.value)}
                  placeholder="C:\Users\you\Documents\Autoflow"
                  spellCheck={false}
                  className="flex-1 px-2.5 py-2 rounded-md bg-raised border border-wire text-ink
                             text-[12px] font-mono placeholder-ink-ghost
                             focus:outline-none focus:border-wire-lit transition-colors"
                />
                <button
                  onClick={browse}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-wire
                             bg-raised text-ink-dim hover:text-ink hover:border-wire-lit
                             transition-colors text-[12px]"
                >
                  <FolderOpen size={13} />
                  Browse
                </button>
              </div>
              <p className="text-[10.5px] text-ink-ghost leading-relaxed">
                Default is <span className="font-mono">Documents/Autoflow</span>. The folder will be created if it doesn't exist yet.
              </p>
            </div>

            {/* Legacy migration banner */}
            {legacy && (
              <div className="mx-7 mb-5 rounded-lg border border-accent/30 bg-accent/[.06] px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <Archive size={14} className="text-accent-soft mt-[2px] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-ink leading-relaxed">
                      Found <span className="font-mono text-accent-soft">{legacy.flows}</span> flow{legacy.flows !== 1 && 's'} from a previous install at
                      <span className="font-mono text-ink-dim"> {legacy.root}</span>.
                    </p>
                    <label className="inline-flex items-center gap-2 mt-2 text-[11.5px] text-ink-dim cursor-pointer">
                      <input type="checkbox" checked={doMigrate} onChange={e => setDoMigrate(e.target.checked)} className="accent-accent" />
                      Move them into the new work directory
                    </label>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-7 mb-5 rounded-md border border-danger/40 bg-danger/10 px-3 py-2">
                <p className="text-[11.5px] font-mono text-danger leading-relaxed">{error}</p>
              </div>
            )}

            <div className="h-px bg-wire mx-7" />

            <div className="flex items-center justify-between px-7 py-5">
              <p className="text-[10.5px] font-mono text-ink-ghost flex items-center gap-1">
                <ExternalLink size={10} />
                machine state stays in appData
              </p>
              <button
                onClick={confirmWorkspace}
                disabled={busy || !path.trim()}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all',
                  busy || !path.trim()
                    ? 'bg-raised text-ink-ghost cursor-not-allowed'
                    : 'bg-accent text-white hover:bg-accent/90 active:scale-[.97] shadow-md shadow-accent/20',
                )}
              >
                Next
                <ArrowRight size={13} strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-[36px] h-[36px] rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
                  <BookOpen size={18} strokeWidth={2} className="text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-accent-soft">Step 2 of 2</div>
                  <div className="text-[18px] font-bold font-display text-ink leading-tight">Import example flows?</div>
                </div>
              </div>
              <p className="text-[12.5px] text-ink-dim leading-relaxed">
                15 ready-made flows covering every node type. Great for learning what's possible or as a starting point.
                You can always import them later from <span className="text-ink font-medium">Settings → Workspace</span>.
              </p>
            </div>

            <div className="h-px bg-wire mx-7" />

            {/* Feature list */}
            <div className="px-7 py-5">
              <ul className="space-y-1.5">
                {EXAMPLE_HIGHLIGHTS.map(item => (
                  <li key={item} className="flex items-start gap-2 text-[12px] text-ink-dim">
                    <Check size={11} className="text-success mt-[3px] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="mx-7 mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2">
                <p className="text-[11.5px] font-mono text-danger leading-relaxed">{error}</p>
              </div>
            )}

            <div className="h-px bg-wire mx-7" />

            <div className="flex items-center justify-end gap-3 px-7 py-5">
              <button
                onClick={onDone}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px]
                           text-ink-dim hover:text-ink transition-colors disabled:opacity-40"
              >
                <SkipForward size={13} />
                Skip for now
              </button>
              <button
                onClick={importAndContinue}
                disabled={busy}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all',
                  busy
                    ? 'bg-raised text-ink-ghost cursor-not-allowed'
                    : 'bg-accent text-white hover:bg-accent/90 active:scale-[.97] shadow-md shadow-accent/20',
                )}
              >
                <BookOpen size={13} />
                {busy ? 'Importing…' : 'Import Examples'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { X, Timer, Globe, Terminal, GitBranch, Plus, Minus, Check, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { useSettingsStore } from '../store/settingsStore';
import { clsx } from 'clsx';
import type { Node, Edge } from '@xyflow/react';
import type { ReactNode } from 'react';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';
import { Select } from './ui/Select';
import { RefField } from './ui/RefField';
import { getUpstreamNodes } from '../lib/graphRefs';
import type { BodyRow } from '../lib/executor';

interface NodePanelProps {
  node:     Node | undefined;
  nodes:    Node[];
  edges:    Edge[];
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onClose:  () => void;
}

const CFG = {
  trigger:   { color: '#6d5bef', icon: <Timer size={13} />,     label: 'Trigger'   },
  rest:      { color: '#00bfff', icon: <Globe size={13} />,        label: 'REST API'  },
  script:    { color: '#05c58c', icon: <Terminal size={13} />,  label: 'Script'    },
  condition: { color: '#f59e0b', icon: <GitBranch size={13} />, label: 'Condition' },
} as const;

/* ─── Sub-components ─────────────────────────── */

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-dim mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, mono = false, type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; type?: 'text' | 'password' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      spellCheck={false}
      className={clsx(
        'w-full px-2.5 py-2 rounded-md bg-raised border border-wire text-ink',
        'text-[12px] placeholder-ink-ghost',
        'focus:outline-none focus:border-wire-lit transition-colors',
        mono && 'font-mono',
      )}
    />
  );
}

function ToggleGroup<T extends string>({
  value, options, onChange,
}: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={clsx(
            'flex-1 py-1.5 rounded-md text-[10.5px] font-mono font-medium transition-all',
            value === opt
              ? 'bg-accent/12 text-accent-soft border border-accent/25'
              : 'bg-raised text-ink-dim border border-wire hover:text-ink hover:border-wire-lit',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ─── Cron field (validation + preview + presets) ─── */

const CRON_PRESETS: { label: string; expr: string; desc: string }[] = [
  { label: 'Every minute',      expr: '* * * * *',     desc: 'every minute (debug)' },
  { label: 'Every 15 min',      expr: '*/15 * * * *',  desc: 'every quarter hour'   },
  { label: 'Hourly :00',        expr: '0 * * * *',     desc: 'top of every hour'    },
  { label: 'Daily 09:00',       expr: '0 9 * * *',     desc: '9:00 AM every day'    },
  { label: 'Weekdays 18:00',    expr: '0 18 * * 1-5',  desc: '6 PM Mon–Fri'         },
  { label: 'Mondays 09:00',     expr: '0 9 * * 1',     desc: '9 AM every Monday'    },
];

interface CronStatus {
  ok:       boolean;
  message:  string;
  next?:    Date;
  human?:   string;
}

function evaluateCron(raw: string): CronStatus {
  const expr = raw.trim();
  if (!expr) return { ok: false, message: 'empty' };
  try {
    const it = CronExpressionParser.parse(expr);
    const next = it.next().toDate();
    let human = '';
    try { human = cronstrue.toString(expr, { use24HourTimeFormat: true }); }
    catch { human = ''; }
    return { ok: true, message: 'ok', next, human };
  } catch (e) {
    return { ok: false, message: (e as Error).message || String(e) };
  }
}

function fmtNext(d: Date): string {
  const diffMs = d.getTime() - Date.now();
  const abs = d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  if (diffMs < 0) return abs;
  if (diffMs < 60_000)     return `${abs} (in ${Math.ceil(diffMs / 1_000)}s)`;
  if (diffMs < 3_600_000)  return `${abs} (in ${Math.floor(diffMs / 60_000)}m)`;
  if (diffMs < 86_400_000) return `${abs} (in ${Math.floor(diffMs / 3_600_000)}h)`;
  return `${abs} (in ${Math.floor(diffMs / 86_400_000)}d)`;
}

function CronField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const status = useMemo(() => evaluateCron(value), [value]);
  return (
    <div>
      <FieldLabel>Cron Expression</FieldLabel>
      <TextInput
        value={value}
        onChange={onChange}
        placeholder="0 9 * * 1-5"
        mono
      />
      <p className="text-[10px] text-ink-ghost mt-1.5 font-mono">
        min hour dom month dow
      </p>

      {value.trim() && (
        status.ok ? (
          <div className="mt-2 rounded-md bg-success/[.06] border border-success/25 px-2.5 py-2">
            <div className="flex items-start gap-1.5">
              <Check size={11} className="text-success mt-[2px] shrink-0" />
              <div className="min-w-0 flex-1 text-[10.5px] leading-relaxed">
                {status.human && <p className="text-ink">{status.human}</p>}
                {status.next && (
                  <p className="text-ink-dim font-mono mt-0.5">
                    Next: {fmtNext(status.next)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-md bg-danger/[.08] border border-danger/30 px-2.5 py-2">
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={11} className="text-danger mt-[2px] shrink-0" />
              <p className="text-[10.5px] text-danger font-mono leading-relaxed break-all">
                {status.message}
              </p>
            </div>
          </div>
        )
      )}

      <div className="mt-3">
        <div className="text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-ghost mb-1.5">
          Presets
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CRON_PRESETS.map(p => (
            <button
              key={p.expr}
              onClick={() => onChange(p.expr)}
              title={`${p.expr}\n${p.desc}`}
              className={clsx(
                'px-2 py-1 rounded-md text-[10.5px] font-mono transition-colors',
                value.trim() === p.expr
                  ? 'bg-accent/14 text-accent-soft border border-accent/28'
                  : 'bg-raised text-ink-dim border border-wire hover:text-ink hover:border-wire-lit',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── REST API fields ───────────────────────── */

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = typeof METHODS[number];

function rowsToJson(rows: BodyRow[]): string {
  const obj: Record<string, string> = {};
  for (const r of rows) {
    const k = (r.key ?? '').trim();
    if (!k) continue;
    obj[k] = r.value ?? '';
  }
  return JSON.stringify(obj, null, 2);
}

function jsonToRows(raw: string): { rows: BodyRow[]; ok: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], ok: true };
  try {
    const v = JSON.parse(trimmed);
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return { rows: [], ok: false };
    const rows: BodyRow[] = Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
      key:   k,
      value: typeof val === 'string' ? val : JSON.stringify(val),
    }));
    return { rows, ok: true };
  } catch {
    return { rows: [], ok: false };
  }
}

interface TestResult { ok: boolean; status: string; body: string }

function coerceValue(raw: string): unknown {
  const t = raw.trim();
  if (t === 'true')  return true;
  if (t === 'false') return false;
  if (t === 'null')  return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

function RestFields({
  data, nodeId, upstream, onUpdate,
}: {
  data: Record<string, unknown>;
  nodeId: string;
  upstream: ReturnType<typeof getUpstreamNodes>;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}) {
  const method   = (((data.method as string) || 'POST').toUpperCase()) as Method;
  const endpoint = (data.endpoint as string) ?? '';
  const bodyMode = ((data.bodyMode as string) === 'json' ? 'json' : 'form') as 'form' | 'json';
  const body     = (data.body as string) ?? '';
  const rows     = ((data.bodyRows as BodyRow[]) ?? []) as BodyRow[];
  const tokenOverride = (data.tokenOverride as string) ?? '';

  const [testState,  setTestState]  = useState<'idle' | 'running' | 'ok' | 'err'>('idle');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function handleTest() {
    setTestState('running');
    setTestResult(null);
    try {
      const settings = useSettingsStore.getState().settings;
      const baseUrl  = (settings.restBaseUrl || '').replace(/\/+$/, '');
      const ep       = endpoint.trim().replace(/^\/+/, '');
      if (!baseUrl) {
        setTestResult({ ok: false, status: 'Config error', body: 'Base URL not set in Settings → REST API' });
        setTestState('err');
        return;
      }
      if (!ep) {
        setTestResult({ ok: false, status: 'Config error', body: 'Endpoint is empty' });
        setTestState('err');
        return;
      }
      const url     = `${baseUrl}/${ep}`;
      const token   = tokenOverride.trim() || settings.restToken;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let bodyText: string | undefined;
      if (method !== 'GET') {
        if (bodyMode === 'form') {
          const obj: Record<string, unknown> = {};
          for (const r of rows.filter(r => (r.key ?? '').trim())) {
            obj[(r.key ?? '').trim()] = coerceValue(r.value ?? '');
          }
          bodyText = JSON.stringify(obj);
        } else if (body.trim()) {
          try { JSON.parse(body); bodyText = body.trim(); }
          catch { setTestResult({ ok: false, status: 'Invalid JSON', body: 'The raw JSON body is not valid JSON' }); setTestState('err'); return; }
        }
      }

      const res  = await tauriFetch(url, { method, headers, body: bodyText });
      const text = await res.text();
      const ok   = res.status >= 200 && res.status < 300;
      const truncated = text.length > 500 ? `${text.slice(0, 500)}… (+${text.length - 500} chars)` : text;
      setTestResult({ ok, status: `${res.status} ${res.statusText || ''}`.trim(), body: truncated });
      setTestState(ok ? 'ok' : 'err');
    } catch (e) {
      setTestResult({ ok: false, status: 'Request failed', body: String(e) });
      setTestState('err');
    }
  }

  const hasBody = method !== 'GET';

  function set(key: string, value: unknown) {
    onUpdate(nodeId, { ...data, [key]: value });
  }

  function setMode(next: 'form' | 'json') {
    if (next === bodyMode) return;
    if (next === 'json') {
      // form → json: build text from rows.
      const text = rows.length === 0 ? body : rowsToJson(rows);
      onUpdate(nodeId, { ...data, bodyMode: 'json', body: text });
    } else {
      // json → form: parse if possible.
      const parsed = jsonToRows(body);
      if (!parsed.ok) {
        const ok = window.confirm('Current body is not a flat JSON object. Switch to form anyway? (existing JSON will stay in the raw editor.)');
        if (!ok) return;
      }
      onUpdate(nodeId, { ...data, bodyMode: 'form', bodyRows: parsed.rows.length > 0 ? parsed.rows : rows });
    }
  }

  function updateRow(idx: number, patch: Partial<BodyRow>) {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    set('bodyRows', next);
  }

  function addRow() {
    set('bodyRows', [...rows, { key: '', value: '' }]);
  }

  function removeRow(idx: number) {
    set('bodyRows', rows.filter((_, i) => i !== idx));
  }

  const fullPath = useMemo(() => {
    const ep = endpoint.trim().replace(/^\/+/, '');
    return ep ? `/${ep}` : '';
  }, [endpoint]);

  return (
    <>
      <div>
        <FieldLabel>Method</FieldLabel>
        <Select
          value={method}
          options={METHODS.map(m => ({ value: m, label: m }))}
          onChange={(v) => set('method', v)}
          mono
        />
      </div>

      <div>
        <FieldLabel>Endpoint</FieldLabel>
        <RefField
          value={endpoint}
          onChange={v => set('endpoint', v)}
          upstream={upstream}
          placeholder="endpoint"
        />
        <p className="text-[10px] text-ink-ghost mt-1.5 leading-relaxed font-mono">
          → {fullPath || '(set in Settings → REST API)'}
        </p>
      </div>

      {hasBody && (
        <div>
          <FieldLabel>Body</FieldLabel>
          <div className="mb-2.5">
            <ToggleGroup
              value={bodyMode}
              options={['form', 'json']}
              onChange={setMode}
            />
          </div>

          {bodyMode === 'form' ? (
            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-[10.5px] text-ink-ghost font-mono italic">no fields yet</p>
              )}
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-1.5 items-start">
                  <input
                    value={r.key}
                    onChange={e => updateRow(i, { key: e.target.value })}
                    placeholder="key"
                    spellCheck={false}
                    className="px-2 py-1.5 rounded-md bg-raised border border-wire text-ink
                               text-[11.5px] font-mono placeholder-ink-ghost
                               focus:outline-none focus:border-wire-lit"
                  />
                  <RefField
                    value={r.value}
                    onChange={v => updateRow(i, { value: v })}
                    upstream={upstream}
                    placeholder="value or ${node-id}"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    className="p-1.5 rounded-md text-ink-ghost hover:text-danger hover:bg-raised transition-colors"
                    title="Remove row"
                  >
                    <Minus size={11} />
                  </button>
                </div>
              ))}
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
                           bg-raised border border-wire text-ink-dim
                           hover:text-ink hover:border-wire-lit
                           text-[11px] font-mono transition-colors"
              >
                <Plus size={11} /> add field
              </button>
              <p className="text-[10px] text-ink-ghost leading-relaxed">
                Values are sent as JSON. Numeric and <span className="font-mono">true/false/null</span> tokens
                are coerced; everything else is a string. Use <span className="font-mono">${'${node-id}'}</span> to pull from upstream.
              </p>
            </div>
          ) : (
            <div>
              <RefField
                value={body}
                onChange={v => set('body', v)}
                upstream={upstream}
                multiline
                rows={8}
                placeholder={'{\n  "key": "value",\n  "ref": "${node-id}"\n}'}
              />
              <p className="text-[10px] text-ink-ghost mt-1.5 leading-relaxed">
                Raw JSON. <span className="font-mono">${'${node-id}'}</span> placeholders are interpolated before parsing.
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <FieldLabel>Token Override</FieldLabel>
        <TextInput
          value={tokenOverride}
          onChange={v => set('tokenOverride', v)}
          placeholder="leave empty to use Settings → REST API token"
          type="password"
          mono
        />
        <p className="text-[10px] text-ink-ghost mt-1.5 leading-relaxed">
          Per-node override for the bearer token. Empty inherits from global settings.
        </p>
      </div>

      {/* Test request */}
      <div>
        <div className="h-px bg-wire/60" />
        <button
          onClick={handleTest}
          disabled={testState === 'running' || !endpoint.trim()}
          className={clsx(
            'mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-md',
            'border text-[12px] font-medium transition-all',
            testState === 'running' || !endpoint.trim()
              ? 'border-wire text-ink-ghost cursor-not-allowed opacity-50'
              : 'border-wire text-ink hover:border-wire-lit hover:bg-raised',
          )}
        >
          {testState === 'running'
            ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
            : <><Play size={12} /> Send test request</>}
        </button>

        {testResult && (
          <div className={clsx(
            'mt-2 rounded-md border px-3 py-2.5 space-y-1.5',
            testResult.ok ? 'bg-success/[.06] border-success/25' : 'bg-danger/[.08] border-danger/30',
          )}>
            <div className="flex items-center gap-1.5">
              {testResult.ok
                ? <Check size={11} className="text-success shrink-0" />
                : <AlertTriangle size={11} className="text-danger shrink-0" />}
              <span className={clsx('text-[11px] font-mono font-semibold', testResult.ok ? 'text-success' : 'text-danger')}>
                {testResult.status}
              </span>
            </div>
            {testResult.body && (
              <pre className="text-[10.5px] text-ink-dim font-mono break-all whitespace-pre-wrap leading-relaxed max-h-[120px] overflow-auto">
                {testResult.body}
              </pre>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Condition editor ───────────────────────── */

const COND_OPS = [
  { value: 'equals',    label: 'equals',     needsValue: true,  description: 'string-equals' },
  { value: 'notEquals', label: 'not equals', needsValue: true,  description: 'string !=' },
  { value: 'contains',  label: 'contains',   needsValue: true,  description: 'substring match' },
  { value: 'matches',   label: 'matches',    needsValue: true,  description: 'JS regex' },
  { value: 'nonempty',  label: 'not empty',  needsValue: false, description: 'value is a non-empty string' },
  { value: 'empty',     label: 'empty',      needsValue: false, description: 'value is empty / whitespace' },
  { value: 'exitZero',  label: 'exit == 0',  needsValue: false, description: 'previous node exited with code 0' },
] as const;

function ConditionFields({
  data, upstream, set,
}: {
  data: Record<string, unknown>;
  upstream: ReturnType<typeof getUpstreamNodes>;
  set: (key: string, value: unknown) => void;
}) {
  const op  = (data.op as string) || 'nonempty';
  const opCfg = COND_OPS.find(o => o.value === op);
  const source = (data.source as string) ?? '${prev}';
  return (
    <>
      <div>
        <FieldLabel>Source</FieldLabel>
        <RefField
          value={source}
          onChange={v => set('source', v)}
          upstream={upstream}
          placeholder="${prev}"
        />
        <p className="text-[10px] text-ink-ghost mt-1.5 leading-relaxed">
          The value to test. Pick an upstream node via <span className="font-mono">Insert ref</span>.
        </p>
      </div>

      <div>
        <FieldLabel>Operator</FieldLabel>
        <Select
          value={op}
          options={COND_OPS.map(o => ({ value: o.value, label: o.label, description: o.description }))}
          onChange={v => set('op', v)}
          placeholder="— pick a test —"
        />
      </div>

      {opCfg?.needsValue && (
        <div>
          <FieldLabel>Compare With</FieldLabel>
          <RefField
            value={(data.value as string) ?? ''}
            onChange={v => set('value', v)}
            upstream={upstream}
            placeholder={op === 'matches' ? '^EXISTS$' : 'exact value to match'}
          />
        </div>
      )}

      <div className="rounded-md bg-raised/50 border border-wire/60 p-2.5">
        <p className="text-[10px] text-ink-ghost leading-relaxed">
          Connect <span className="text-success font-mono">true</span> to the path that runs when the condition is met, and
          <span className="text-danger font-mono"> false</span> to the alternate path. Nodes on the unselected branch are skipped at runtime.
        </p>
      </div>
    </>
  );
}

/* ─── NodePanel ──────────────────────────────── */

export function NodePanel({ node, nodes, edges, onUpdate, onClose }: NodePanelProps) {
  if (!node) return null;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const safeNode = node!;

  const type = (safeNode.type ?? 'script') as keyof typeof CFG;
  const cfg  = CFG[type] ?? CFG.script;
  const data = safeNode.data as Record<string, unknown>;

  function set(key: string, value: unknown) {
    onUpdate(safeNode.id, { ...data, [key]: value });
  }

  const upstream = useMemo(
    () => getUpstreamNodes(safeNode.id, nodes, edges),
    [safeNode.id, nodes, edges],
  );

  return (
    <aside
      className="w-[300px] shrink-0 flex flex-col bg-surface border-l border-wire overflow-hidden"
      style={{ animation: 'slide-in-right 0.2s ease both' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-wire shrink-0">
        <div className="flex items-center gap-2">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <span className="text-[13px] font-semibold font-display text-ink">{cfg.label}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-ink-ghost hover:text-ink hover:bg-raised transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* Common: label */}
        <div>
          <FieldLabel>Label</FieldLabel>
          <TextInput
            value={(data.label as string) ?? ''}
            onChange={v => set('label', v)}
            placeholder="Node label"
          />
        </div>

        {/* ── Trigger ───────────────────────── */}
        {type === 'trigger' && (
          <>
            <div>
              <FieldLabel>Mode</FieldLabel>
              <ToggleGroup
                value={(data.mode as 'manual' | 'cron') ?? 'manual'}
                options={['manual', 'cron']}
                onChange={v => set('mode', v)}
              />
            </div>
            {data.mode === 'cron' && (
              <>
                <CronField
                  value={(data.cron as string) ?? ''}
                  onChange={v => set('cron', v)}
                />
                <div>
                  <FieldLabel>Catch-up Policy</FieldLabel>
                  <ToggleGroup
                    value={(data.catchUp as 'skip' | 'run-once' | 'run-all') ?? 'skip'}
                    options={['skip', 'run-once', 'run-all']}
                    onChange={v => set('catchUp', v)}
                  />
                  <p className="text-[10px] text-ink-ghost mt-1.5 leading-relaxed">
                    What to do for ticks missed while the app was closed.
                  </p>
                </div>
                <div>
                  <FieldLabel>Armed</FieldLabel>
                  <ToggleGroup
                    value={(data.enabled === false ? 'off' : 'on') as 'on' | 'off'}
                    options={['on', 'off']}
                    onChange={v => set('enabled', v === 'on')}
                  />
                  <p className="text-[10px] text-ink-ghost mt-1.5 leading-relaxed">
                    Save the flow after changes to arm the scheduler.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* ── REST API ──────────────────────── */}
        {type === 'rest' && (
          <RestFields data={data} nodeId={safeNode.id} upstream={upstream} onUpdate={onUpdate} />
        )}

        {/* ── Script ────────────────────────── */}
        {type === 'script' && (
          <>
            <div>
              <FieldLabel>Shell</FieldLabel>
              <ToggleGroup
                value={(data.shell as 'cmd' | 'powershell' | 'bash') ?? 'cmd'}
                options={['cmd', 'powershell', 'bash']}
                onChange={v => set('shell', v)}
              />
            </div>
            <div>
              <FieldLabel>Script</FieldLabel>
              <RefField
                value={(data.script as string) ?? ''}
                onChange={v => set('script', v)}
                upstream={upstream}
                multiline
                rows={5}
                placeholder={'echo Hello World'}
              />
            </div>
            <div>
              <FieldLabel>Work Directory</FieldLabel>
              <RefField
                value={(data.workDir as string) ?? ''}
                onChange={v => set('workDir', v)}
                upstream={upstream}
                placeholder="Leave empty for default"
              />
            </div>
          </>
        )}

        {/* ── Condition ─────────────────────── */}
        {type === 'condition' && (
          <ConditionFields data={data} upstream={upstream} set={set} />
        )}

      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-wire shrink-0">
        <p className="text-[10px] font-mono text-ink-ghost">
          node · {safeNode.id}
        </p>
      </div>
    </aside>
  );
}

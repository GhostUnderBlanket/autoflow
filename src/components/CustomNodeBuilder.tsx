import { useState, useCallback } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import type { CustomNodeDef, CustomNodeField, CustomFieldType } from '../types/customNode';

interface FieldDraft {
  name:        string;
  label:       string;
  type:        CustomFieldType;
  placeholder: string;
  default:     string;
  options:     string; // comma-separated
}

interface BuilderState {
  id:          string;
  label:       string;
  color:       string;
  description: string;
  version:     string;
  fields:      FieldDraft[];
  execType:    'script' | 'js';
  shell:       'cmd' | 'powershell' | 'bash';
  template:    string;
  fn:          string;
}

function emptyField(): FieldDraft {
  return { name: '', label: '', type: 'text', placeholder: '', default: '', options: '' };
}

function buildState(def?: CustomNodeDef): BuilderState {
  if (!def) return {
    id: '', label: '', color: '#6366f1', description: '', version: '1.0.0',
    fields: [emptyField()],
    execType: 'js', shell: 'powershell', template: '', fn: '',
  };
  return {
    id:          def.id,
    label:       def.label,
    color:       def.color,
    description: def.description ?? '',
    version:     def.version ?? '',
    fields: def.fields.map(f => ({
      name:        f.name,
      label:       f.label,
      type:        f.type,
      placeholder: f.placeholder ?? '',
      default:     f.default ?? '',
      options:     f.options?.join(', ') ?? '',
    })),
    execType: def.executor.type,
    shell:    def.executor.type === 'script' ? def.executor.shell : 'powershell',
    template: def.executor.type === 'script' ? def.executor.template : '',
    fn:       def.executor.type === 'js'     ? def.executor.fn       : '',
  };
}

function toDef(s: BuilderState): CustomNodeDef {
  const fields: CustomNodeField[] = s.fields
    .filter(f => f.name.trim())
    .map(f => {
      const field: CustomNodeField = {
        name:  f.name.trim(),
        label: f.label.trim() || f.name.trim(),
        type:  f.type,
      };
      if (f.placeholder.trim()) field.placeholder = f.placeholder.trim();
      if (f.default.trim())     field.default     = f.default.trim();
      if (f.type === 'select' && f.options.trim()) {
        field.options = f.options.split(',').map(o => o.trim()).filter(Boolean);
      }
      return field;
    });

  const executor = s.execType === 'script'
    ? { type: 'script' as const, shell: s.shell, template: s.template }
    : { type: 'js'     as const, fn: s.fn };

  const def: CustomNodeDef = {
    id:       s.id.trim(),
    label:    s.label.trim(),
    color:    s.color,
    fields,
    executor,
  };
  if (s.description.trim()) def.description = s.description.trim();
  if (s.version.trim())     def.version     = s.version.trim();
  return def;
}

const FIELD_TYPES: CustomFieldType[] = ['text', 'textarea', 'number', 'toggle', 'select'];

interface Props {
  initial?: CustomNodeDef;
  onSave:  (def: CustomNodeDef) => Promise<void>;
  onClose: () => void;
}

export function CustomNodeBuilder({ initial, onSave, onClose }: Props) {
  const isEdit = !!initial;
  const [state, setState] = useState<BuilderState>(() => buildState(initial));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const patch = useCallback((partial: Partial<BuilderState>) => {
    setState(s => ({ ...s, ...partial }));
  }, []);

  function patchField(i: number, partial: Partial<FieldDraft>) {
    setState(s => {
      const fields = [...s.fields];
      fields[i] = { ...fields[i], ...partial };
      return { ...s, fields };
    });
  }

  function moveField(i: number, dir: -1 | 1) {
    setState(s => {
      const fields = [...s.fields];
      const j = i + dir;
      if (j < 0 || j >= fields.length) return s;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...s, fields };
    });
  }

  function validate(): string | null {
    if (!state.id.trim())                          return 'ID is required.';
    if (!/^[a-z0-9-]+$/.test(state.id.trim()))    return 'ID must be lowercase letters, numbers, and hyphens only.';
    if (!state.label.trim())                       return 'Label is required.';
    if (state.execType === 'script' && !state.template.trim()) return 'Script template is required.';
    if (state.execType === 'js'     && !state.fn.trim())       return 'JS function is required.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(toDef(state));
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full px-2.5 py-2 rounded-md bg-raised border border-wire text-ink text-[12px] placeholder-ink-ghost focus:outline-none focus:border-wire-lit transition-colors';
  const inpSm = 'w-full px-2 py-1.5 rounded-md bg-canvas border border-wire text-ink text-[11.5px] placeholder-ink-ghost focus:outline-none focus:border-wire-lit transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/80 backdrop-blur-sm overflow-auto py-8 px-4">
      <div className="w-full max-w-2xl bg-canvas border border-wire rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-wire">
          <h2 className="text-[16px] font-bold text-ink font-display">
            {isEdit ? `Edit: ${initial!.label}` : 'New Custom Node'}
          </h2>
          <button onClick={onClose} className="text-ink-ghost hover:text-ink transition-colors p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>

          {/* Identity */}
          <section className="space-y-3">
            <p className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-ink-ghost">Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9.5px] font-mono text-ink-dim mb-1.5">
                  ID <span className="text-danger">*</span>
                </label>
                <input
                  value={state.id}
                  onChange={e => !isEdit && patch({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  readOnly={isEdit}
                  placeholder="my-node"
                  spellCheck={false}
                  className={clsx(inp, 'font-mono', isEdit && 'opacity-50 cursor-not-allowed')}
                />
                {isEdit && (
                  <p className="text-[10px] text-ink-ghost mt-1">ID is locked — determines the file name.</p>
                )}
              </div>
              <div>
                <label className="block text-[9.5px] font-mono text-ink-dim mb-1.5">
                  Label <span className="text-danger">*</span>
                </label>
                <input
                  value={state.label}
                  onChange={e => patch({ label: e.target.value })}
                  placeholder="My Node"
                  spellCheck={false}
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-mono text-ink-dim mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={state.color}
                    onChange={e => patch({ color: e.target.value })}
                    className="w-9 h-9 rounded-md border border-wire cursor-pointer bg-raised shrink-0 p-0.5"
                  />
                  <input
                    value={state.color}
                    onChange={e => patch({ color: e.target.value })}
                    placeholder="#6366f1"
                    spellCheck={false}
                    className={clsx(inp, 'font-mono')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9.5px] font-mono text-ink-dim mb-1.5">Version</label>
                <input
                  value={state.version}
                  onChange={e => patch({ version: e.target.value })}
                  placeholder="1.0.0"
                  spellCheck={false}
                  className={clsx(inp, 'font-mono')}
                />
              </div>
            </div>
            <div>
              <label className="block text-[9.5px] font-mono text-ink-dim mb-1.5">Description</label>
              <input
                value={state.description}
                onChange={e => patch({ description: e.target.value })}
                placeholder="What does this node do?"
                className={inp}
              />
            </div>
          </section>

          {/* Fields */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-ink-ghost">Fields</p>
              <button
                onClick={() => setState(s => ({ ...s, fields: [...s.fields, emptyField()] }))}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-accent-soft bg-accent/[.08] border border-accent/25 hover:bg-accent/[.16] transition-colors"
              >
                <Plus size={11} /> Add field
              </button>
            </div>

            {state.fields.length === 0 && (
              <p className="text-[11.5px] text-ink-ghost text-center py-3">
                No fields — node will have no configuration inputs.
              </p>
            )}

            {state.fields.map((field, i) => (
              <div key={i} className="rounded-lg border border-wire bg-raised/40 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-mono text-ink-ghost mb-1">name</label>
                      <input
                        value={field.name}
                        onChange={e => patchField(i, { name: e.target.value.replace(/\s/g, '_') })}
                        placeholder="fieldName"
                        spellCheck={false}
                        className={clsx(inpSm, 'font-mono')}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-ink-ghost mb-1">label</label>
                      <input
                        value={field.label}
                        onChange={e => patchField(i, { label: e.target.value })}
                        placeholder="Field Label"
                        spellCheck={false}
                        className={inpSm}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-0.5 mt-[18px]">
                    <button
                      onClick={() => moveField(i, -1)}
                      disabled={i === 0}
                      className="p-1 rounded text-ink-ghost hover:text-ink disabled:opacity-30 transition-colors"
                      title="Move up"
                    ><ChevronUp size={13} /></button>
                    <button
                      onClick={() => moveField(i, 1)}
                      disabled={i === state.fields.length - 1}
                      className="p-1 rounded text-ink-ghost hover:text-ink disabled:opacity-30 transition-colors"
                      title="Move down"
                    ><ChevronDown size={13} /></button>
                    <button
                      onClick={() => setState(s => ({ ...s, fields: s.fields.filter((_, j) => j !== i) }))}
                      className="p-1 rounded text-ink-ghost hover:text-danger transition-colors"
                      title="Remove field"
                    ><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono text-ink-ghost mb-1">type</label>
                    <select
                      value={field.type}
                      onChange={e => patchField(i, { type: e.target.value as CustomFieldType })}
                      className={clsx(inpSm, 'font-mono')}
                    >
                      {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-ink-ghost mb-1">placeholder</label>
                    <input
                      value={field.placeholder}
                      onChange={e => patchField(i, { placeholder: e.target.value })}
                      placeholder="optional"
                      className={inpSm}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-ink-ghost mb-1">default</label>
                    <input
                      value={field.default}
                      onChange={e => patchField(i, { default: e.target.value })}
                      placeholder="optional"
                      className={inpSm}
                    />
                  </div>
                </div>

                {field.type === 'select' && (
                  <div>
                    <label className="block text-[9px] font-mono text-ink-ghost mb-1">options (comma-separated)</label>
                    <input
                      value={field.options}
                      onChange={e => patchField(i, { options: e.target.value })}
                      placeholder="option1, option2, option3"
                      spellCheck={false}
                      className={clsx(inpSm, 'font-mono')}
                    />
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Executor */}
          <section className="space-y-3">
            <p className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-ink-ghost">Executor</p>

            <div className="flex gap-1.5">
              {(['script', 'js'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => patch({ execType: t })}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-[11.5px] font-mono font-medium transition-all border',
                    state.execType === t
                      ? 'bg-accent/14 text-accent-soft border-accent/28'
                      : 'bg-raised text-ink-dim border-wire hover:text-ink hover:border-wire-lit',
                  )}
                >
                  {t === 'script' ? 'Shell script' : 'JavaScript'}
                </button>
              ))}
            </div>

            {state.execType === 'script' && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {(['cmd', 'powershell', 'bash'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => patch({ shell: s })}
                      className={clsx(
                        'px-2.5 py-[5px] rounded-md text-[11px] font-mono font-medium transition-all border',
                        state.shell === s
                          ? 'bg-accent/10 text-accent-soft border-accent/25'
                          : 'bg-raised text-ink-ghost border-wire hover:text-ink-dim hover:border-wire-lit',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-[9.5px] font-mono text-ink-ghost mb-1.5">
                    Template — use{' '}
                    <code className="text-ink bg-raised px-1 rounded">{'${field.NAME}'}</code>{' '}
                    for field values
                  </label>
                  <textarea
                    value={state.template}
                    onChange={e => patch({ template: e.target.value })}
                    placeholder={`Write-Output "\${field.message}"`}
                    rows={8}
                    spellCheck={false}
                    className="w-full px-3 py-2.5 rounded-md bg-raised border border-wire text-ink text-[11.5px] font-mono placeholder-ink-ghost focus:outline-none focus:border-wire-lit transition-colors resize-y leading-relaxed"
                  />
                </div>
              </div>
            )}

            {state.execType === 'js' && (
              <div>
                <label className="block text-[9.5px] font-mono text-ink-ghost mb-1.5">
                  Async arrow function — receives{' '}
                  <code className="text-ink bg-raised px-1 rounded">{'{ fields, prev, log }'}</code>
                </label>
                <textarea
                  value={state.fn}
                  onChange={e => patch({ fn: e.target.value })}
                  placeholder={`async ({ fields, prev, log }) => {\n  // fields.myField, log('msg'), return 'stdout'\n}`}
                  rows={10}
                  spellCheck={false}
                  className="w-full px-3 py-2.5 rounded-md bg-raised border border-wire text-ink text-[11.5px] font-mono placeholder-ink-ghost focus:outline-none focus:border-wire-lit transition-colors resize-y leading-relaxed"
                />
              </div>
            )}
          </section>

          {error && (
            <p className="text-[11px] text-danger font-mono">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-wire">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[12px] font-medium text-ink-dim hover:text-ink hover:bg-raised transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={clsx(
              'px-4 py-2 rounded-lg text-[12px] font-semibold transition-all',
              saving
                ? 'bg-accent/50 text-white/60 cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent/90 active:scale-[.97]',
            )}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create node'}
          </button>
        </div>
      </div>
    </div>
  );
}

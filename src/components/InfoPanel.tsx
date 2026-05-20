import { useState, useRef } from 'react';
import { FileText, X, Tag } from 'lucide-react';
import { tagColor } from '../lib/tagColor';

interface InfoPanelProps {
  description: string;
  onDescriptionChange: (v: string) => void;
  tags:    string[];
  onTagsChange: (tags: string[]) => void;
  allTags: string[];
  onClose: () => void;
}

export function InfoPanel({ description, onDescriptionChange, tags, onTagsChange, allTags, onClose }: InfoPanelProps) {
  const [tagInput,   setTagInput]   = useState('');
  const [dropOpen,   setDropOpen]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = allTags.filter(t =>
    !tags.includes(t) && t.includes(tagInput.toLowerCase().replace(/\s+/g, '-'))
  );

  function commitTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) onTagsChange([...tags, t]);
    setTagInput('');
    setDropOpen(false);
  }

  function removeTag(t: string) {
    onTagsChange(tags.filter(x => x !== t));
  }

  return (
    <aside
      className="w-[300px] shrink-0 flex flex-col bg-surface border-l border-wire overflow-hidden"
      style={{ animation: 'slide-in-right 0.2s ease both' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-wire shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-accent-soft"><FileText size={13} /></span>
          <span className="text-[13px] font-semibold font-display text-ink">Info</span>
        </div>
        <button onClick={onClose} title="Close" className="text-ink-ghost hover:text-ink transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
        {/* Description */}
        <div>
          <label className="block text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-dim mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            rows={4}
            placeholder="What does this flow do?"
            spellCheck={false}
            className="w-full px-2.5 py-2 rounded-md bg-raised border border-wire text-ink
                       text-[11.5px] font-mono placeholder-ink-ghost resize-none
                       focus:outline-none focus:border-wire-lit transition-colors leading-relaxed"
          />
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag size={10} className="text-ink-dim" />
            <label className="text-[9.5px] font-mono tracking-[0.12em] uppercase text-ink-dim">
              Tags
            </label>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-mono ${tagColor(t)}`}>
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:opacity-60 transition-opacity">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              ref={inputRef}
              value={tagInput}
              onChange={e => { setTagInput(e.target.value); setDropOpen(true); }}
              onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 120)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                  e.preventDefault();
                  commitTag(tagInput);
                }
                if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                  onTagsChange(tags.slice(0, -1));
                }
                if (e.key === 'Escape') { setDropOpen(false); inputRef.current?.blur(); }
              }}
              placeholder="add tag…"
              className="w-full px-2.5 py-1.5 rounded-md bg-raised border border-wire text-ink
                         text-[11.5px] font-mono placeholder-ink-ghost
                         focus:outline-none focus:border-wire-lit transition-colors"
            />

            {dropOpen && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-wire
                           bg-surface shadow-lg shadow-black/40 overflow-hidden"
                style={{ animation: 'fade-down 0.1s ease both' }}
              >
                {suggestions.map(t => (
                  <button
                    key={t}
                    onMouseDown={e => { e.preventDefault(); commitTag(t); }}
                    className="w-full text-left px-3 py-1.5 text-[11.5px] font-mono text-ink-dim
                               hover:bg-raised hover:text-ink transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

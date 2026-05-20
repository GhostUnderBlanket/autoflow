import { type NodeProps } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#a78bfa';

export function OpenUrlNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  const url = ((d.url as string) ?? '').trim();
  const preview = url.replace(/^https?:\/\//, '').slice(0, 28);
  return (
    <BaseNode
      color={COLOR} typeLabel="open url" icon={<ExternalLink size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'open url'}
      </div>
      {preview
        ? <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{preview}</div>
        : <div className="text-[10px] text-ink-ghost mt-0.5 italic">no url or path set</div>
      }
    </BaseNode>
  );
}

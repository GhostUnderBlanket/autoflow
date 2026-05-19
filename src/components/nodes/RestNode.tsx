import { type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#00bfff';

export function RestNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;

  const method   = ((d.method   as string) || 'POST').toUpperCase();
  const endpoint = ((d.endpoint as string) ?? '').trim();
  const label    = (d.label as string) || 'REST API';

  return (
    <BaseNode
      color={COLOR} typeLabel="rest" icon={<Globe size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug flex-1 min-w-0">
          {label}
        </div>
        <span
          className="text-[8.5px] font-mono uppercase tracking-wider px-1.5 py-[1px] rounded shrink-0"
          style={{ color: COLOR, background: `${COLOR}1f` }}
        >
          {method}
        </span>
      </div>
      {endpoint
        ? <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80" title={endpoint}>
            /{endpoint.replace(/^\/+/, '')}
          </div>
        : <div className="text-[10px] text-ink-ghost mt-0.5 italic">no endpoint set</div>
      }
    </BaseNode>
  );
}

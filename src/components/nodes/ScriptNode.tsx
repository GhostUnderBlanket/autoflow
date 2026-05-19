import { type NodeProps } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#05c58c';

export function ScriptNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode
      color={COLOR} typeLabel="script" icon={<Terminal size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'script'}
      </div>
      {d.shell
        ? <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{String(d.shell)}</div>
        : null
      }
    </BaseNode>
  );
}

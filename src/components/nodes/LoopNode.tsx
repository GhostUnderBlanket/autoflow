import { type NodeProps } from '@xyflow/react';
import { Repeat2 } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#05c58c';

export function LoopNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  const mode  = (d.mode as string) || 'repeat';
  const count = Number(d.count) || 3;

  const subtitle =
    mode === 'repeat'  ? `×${count} iterations` :
    mode === 'retry'   ? `retry ×${count}`       :
                         'for each item';

  return (
    <BaseNode
      color={COLOR} typeLabel="loop" icon={<Repeat2 size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'loop'}
      </div>
      <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{subtitle}</div>
    </BaseNode>
  );
}

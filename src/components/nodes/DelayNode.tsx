import { type NodeProps } from '@xyflow/react';
import { Hourglass } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#14b8a6';

export function DelayNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  const ms = Number(d.ms ?? 1000);
  const label =
    ms >= 1000
      ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
      : `${ms}ms`;
  return (
    <BaseNode
      color={COLOR} typeLabel="delay" icon={<Hourglass size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'delay'}
      </div>
      <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">
        {label}
      </div>
    </BaseNode>
  );
}

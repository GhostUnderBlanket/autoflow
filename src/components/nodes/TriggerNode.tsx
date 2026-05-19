import { type NodeProps } from '@xyflow/react';
import { Timer } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#6d5bef';

export function TriggerNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode
      color={COLOR} typeLabel="trigger" icon={<Timer size={10} />}
      selected={selected} isConnectable={isConnectable} hasInput={false}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'Trigger'}
      </div>
      {d.mode === 'cron' && d.cron
        ? <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{String(d.cron)}</div>
        : <div className="text-[10px] text-ink-ghost font-mono mt-0.5">manual</div>
      }
    </BaseNode>
  );
}

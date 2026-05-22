import { type NodeProps } from '@xyflow/react';
import { Workflow } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#818cf8';

export function SubflowNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  const flowName = ((d.flowName as string) || (d.flowId as string) || '').trim();
  return (
    <BaseNode
      color={COLOR} typeLabel="sub-flow" icon={<Workflow size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'sub-flow'}
      </div>
      {flowName
        ? <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">↪ {flowName}</div>
        : <div className="text-[10px] text-ink-ghost mt-0.5 italic">no flow selected</div>
      }
    </BaseNode>
  );
}

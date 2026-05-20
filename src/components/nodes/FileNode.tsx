import { type NodeProps } from '@xyflow/react';
import { FolderOpen } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#f59e0b';

export function FileNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  const op = (d.operation as string) || 'read';
  return (
    <BaseNode
      color={COLOR} typeLabel="file" icon={<FolderOpen size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'file'}
      </div>
      <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{op}</div>
    </BaseNode>
  );
}

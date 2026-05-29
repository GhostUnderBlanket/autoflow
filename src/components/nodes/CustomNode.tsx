import { type NodeProps } from '@xyflow/react';
import { Blocks } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { useCustomNodeStore } from '../../store/customNodeStore';

export function CustomNode({ data, selected, isConnectable }: NodeProps) {
  const d = data as Record<string, unknown>;
  const defId = (d.defId as string) ?? '';
  const def = useCustomNodeStore(s => s.defs.find(x => x.id === defId));

  const color = def?.color ?? '#888888';
  const label = (d.label as string) || def?.label || 'Custom';

  if (!def) {
    return (
      <BaseNode
        color="#888888" typeLabel="custom" icon={<Blocks size={10} />}
        selected={selected} isConnectable={isConnectable}
        runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
      >
        <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
          {label}
        </div>
        <div className="text-[10px] text-danger font-mono mt-0.5 truncate opacity-80">
          ⚠ def not found{defId ? `: ${defId}` : ''}
        </div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      color={color} typeLabel={def.id} icon={<Blocks size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {label}
      </div>
      {def.description ? (
        <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">
          {def.description}
        </div>
      ) : (
        <div className="text-[10px] text-ink-ghost font-mono mt-0.5 opacity-60">
          {def.fields.length} field{def.fields.length !== 1 ? 's' : ''}
        </div>
      )}
    </BaseNode>
  );
}

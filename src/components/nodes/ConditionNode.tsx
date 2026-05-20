import { type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#00bfff';

const OP_LABELS: Record<string, string> = {
  equals:     '==',
  notEquals:  '≠',
  contains:   'contains',
  matches:    '~ regex',
  nonempty:   'not empty',
  empty:      'empty',
  exitZero:   'exit == 0',
};

export function ConditionNode({ data, selected, isConnectable }: NodeProps) {
  const d  = data as Record<string, unknown>;
  const op = (d.op as string) || 'nonempty';

  const summary =
    op === 'exitZero' ? 'exit == 0'
  : op === 'empty'    ? 'value is empty'
  : op === 'nonempty' ? 'value is not empty'
  : `${(d.source as string) || '${prev}'} ${OP_LABELS[op] ?? op} "${(d.value as string) ?? ''}"`;

  return (
    <BaseNode
      color={COLOR} typeLabel="condition" icon={<GitBranch size={10} />}
      selected={selected} isConnectable={isConnectable}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
      outputs={[
        { id: 'true',  label: 'true',  color: '#05c58c', top: 26 },
        { id: 'false', label: 'false', color: '#e84040', top: 56 },
      ]}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'Condition'}
      </div>
      <div className="text-[9.5px] text-ink-dim font-mono mt-0.5 truncate opacity-80" title={summary}>
        {summary}
      </div>
    </BaseNode>
  );
}

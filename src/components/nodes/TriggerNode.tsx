import { type NodeProps } from '@xyflow/react';
import { Timer, Eye, Webhook } from 'lucide-react';
import { BaseNode } from './BaseNode';

const COLOR = '#6d5bef';

export function TriggerNode({ data, selected, isConnectable }: NodeProps) {
  const d    = data as Record<string, unknown>;
  const mode = (d.mode as string) ?? 'manual';

  const icon =
    mode === 'watch'   ? <Eye     size={10} /> :
    mode === 'webhook' ? <Webhook size={10} /> :
                         <Timer   size={10} />;

  let sub: React.ReactNode;
  if (mode === 'cron' && d.cron) {
    sub = <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{String(d.cron)}</div>;
  } else if (mode === 'watch') {
    const p = ((d.watchPath as string) ?? '').trim();
    sub = <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">
      {p ? p.split(/[\\/]/).pop() : '(no path)'}
    </div>;
  } else if (mode === 'webhook') {
    const port = d.port ? `:${d.port}` : ':3000';
    const path = ((d.webhookPath as string) ?? '/').trim() || '/';
    sub = <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate opacity-80">{port}{path}</div>;
  } else {
    sub = <div className="text-[10px] text-ink-ghost font-mono mt-0.5">manual</div>;
  }

  return (
    <BaseNode
      color={COLOR} typeLabel="trigger" icon={icon}
      selected={selected} isConnectable={isConnectable} hasInput={false}
      runStatus={d._runStatus as 'running' | 'success' | 'error' | undefined}
    >
      <div className="text-[12px] font-medium text-ink truncate font-mono leading-snug">
        {(d.label as string) || 'Trigger'}
      </div>
      {sub}
    </BaseNode>
  );
}

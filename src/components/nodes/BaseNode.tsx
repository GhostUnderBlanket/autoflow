import { Handle, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import type { ReactNode, CSSProperties } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const SURFACE = { dark: '#0f0f12', light: '#ffffff' };
const WIRE    = { dark: '#1d1d24', light: '#e0e0ec' };
const WIRE_LIT= { dark: '#2e2e3c', light: '#c4c4d8' };
const CANVAS  = { dark: '#080809', light: '#f5f5fa' };

interface CustomOutput {
  id:    string;
  label: string;
  color: string;
  /** Vertical offset within the node. */
  top:   number;
}

interface BaseNodeProps {
  color:      string;
  typeLabel:  string;
  icon:       ReactNode;
  children:   ReactNode;
  selected:   boolean;
  isConnectable: boolean;
  hasInput?:  boolean;
  hasOutput?: boolean;
  /** When set, replaces the single right-side output handle with labeled ones. */
  outputs?:   CustomOutput[];
  /** Injected by FlowEditor during a run. */
  runStatus?: 'running' | 'success' | 'error';
}

const RUN_RING: Record<string, string> = {
  running: 'shadow-[0_0_0_2px_#3b82f6]',
  success: 'shadow-[0_0_0_2px_#05c58c]',
  error:   'shadow-[0_0_0_2px_#e84040]',
};

export function BaseNode({
  color, typeLabel, icon, children, selected, isConnectable,
  hasInput = true, hasOutput = true, outputs, runStatus,
}: BaseNodeProps) {
  const hasCustomOutputs = (outputs?.length ?? 0) > 0;
  const t = useSettingsStore.getState().settings.theme;
  const bg            = SURFACE[t];
  const border        = selected ? WIRE_LIT[t] : WIRE[t];
  const handleStyle   = (c: string) => ({
    background: c,
    border:     `2px solid ${CANVAS[t]}`,
    boxShadow:  'none',
    outline:    'none',
    width:      10,
    height:     10,
  });
  return (
    <div
      className={clsx(
        'rf-node-card flex rounded-[8px] border',
        'transition-all duration-150 relative overflow-visible',
        runStatus && RUN_RING[runStatus],
      )}
      style={{ '--node-color': color, width: 188, background: bg, borderColor: border } as CSSProperties}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          style={handleStyle(color)}
        />
      )}

      {/* Left color strip — rounded on the left to follow the outer corner */}
      <div className="w-[3px] shrink-0 rounded-l-[8px]" style={{ background: color }} />

      {/* Body */}
      <div className="flex-1 px-3 py-2.5 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span style={{ color, opacity: 0.85 }}>{icon}</span>
          <span
            className="text-[9px] font-mono tracking-[0.12em] uppercase"
            style={{ color, opacity: 0.85 }}
          >
            {typeLabel}
          </span>
        </div>
        {children}
      </div>

      {hasOutput && !hasCustomOutputs && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          style={handleStyle(color)}
        />
      )}

      {hasCustomOutputs && outputs!.map(out => (
        <div key={out.id}>
          <Handle
            id={out.id}
            type="source"
            position={Position.Right}
            isConnectable={isConnectable}
            style={{
              ...handleStyle(out.color),
              top: out.top,
            }}
          />
          <span
            className="absolute text-[8.5px] font-mono uppercase tracking-wider
                       pointer-events-none whitespace-nowrap select-none"
            style={{ top: out.top - 7, left: '100%', marginLeft: 6, color: out.color }}
          >
            {out.label}
          </span>
        </div>
      ))}
    </div>
  );
}

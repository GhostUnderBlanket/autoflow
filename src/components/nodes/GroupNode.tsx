import { useCallback } from 'react';
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

const SNAP = 20;
const COLLAPSED_W = 180;
const COLLAPSED_H = 32;

export function GroupNode({ id, data, selected }: NodeProps) {
  const label       = (data.label as string) || 'Group';
  const collapsed   = (data.collapsed as boolean) ?? false;
  const snapEnabled = useSettingsStore(s => s.settings.snapEnabled);
  const { setNodes } = useReactFlow();

  const handleResizeEnd = useCallback(
    (_evt: unknown, params: { x: number; y: number; width: number; height: number }) => {
      if (!snapEnabled) return;
      const w = Math.round(params.width  / SNAP) * SNAP;
      const h = Math.round(params.height / SNAP) * SNAP;
      if (w === params.width && h === params.height) return;
      setNodes(nds =>
        nds.map(n => n.id === id ? { ...n, style: { ...n.style, width: w, height: h } } : n),
      );
    },
    [snapEnabled, id, setNodes],
  );

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(nds => {
      const nowCollapsed = !collapsed;
      return nds.map(n => {
        if (n.id === id) {
          return nowCollapsed
            ? {
                ...n,
                style: { ...n.style, width: COLLAPSED_W, height: COLLAPSED_H },
                data: {
                  ...n.data,
                  collapsed: true,
                  _expandedWidth:  (n.style?.width  as number) ?? 200,
                  _expandedHeight: (n.style?.height as number) ?? 100,
                },
              }
            : {
                ...n,
                style: {
                  ...n.style,
                  width:  (n.data._expandedWidth  as number) ?? 200,
                  height: (n.data._expandedHeight as number) ?? 100,
                },
                data: { ...n.data, collapsed: false },
              };
        }
        if ((n as { parentId?: string }).parentId === id) {
          return { ...n, hidden: nowCollapsed };
        }
        return n;
      });
    });
  }, [id, collapsed, setNodes]);

  if (collapsed) {
    return (
      <div
        style={{
          width: COLLAPSED_W, height: COLLAPSED_H,
          borderRadius: 6,
          border: '2px solid rgba(109,91,239,0.55)',
          background: 'transparent',
          boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', gap: 6,
          paddingLeft: 10, paddingRight: 8,
          cursor: 'pointer',
        }}
        onDoubleClick={handleToggleCollapse}
      >
        <button
          onClick={handleToggleCollapse}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'rgba(157,139,244,0.9)', display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronRight size={12} />
        </button>
        <span style={{
          fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'rgba(157,139,244,0.9)', userSelect: 'none', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible={selected ?? false}
        minWidth={120}
        minHeight={80}
        onResizeEnd={handleResizeEnd}
        lineStyle={{ borderColor: '#6d5bef', borderWidth: 1.5 }}
        handleStyle={{ background: '#6d5bef', borderColor: '#6d5bef', width: 8, height: 8, borderRadius: 2 }}
      />
      <div
        style={{
          width: '100%', height: '100%', borderRadius: 10,
          border: `2px dashed ${selected ? 'rgba(109,91,239,0.55)' : 'rgba(100,100,160,0.25)'}`,
          background: 'transparent',
          boxSizing: 'border-box', position: 'relative',
          pointerEvents: selected ? 'all' : 'none',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 5, left: 8, right: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            pointerEvents: 'all',
          }}
        >
          <button
            onClick={handleToggleCollapse}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: selected ? 'rgba(157,139,244,0.9)' : 'rgba(120,120,170,0.5)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronDown size={10} />
          </button>
          <span
            style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: selected ? 'rgba(157,139,244,0.9)' : 'rgba(120,120,170,0.5)',
              userSelect: 'none', pointerEvents: 'none',
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </>
  );
}

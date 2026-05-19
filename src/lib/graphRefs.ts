import type { Node, Edge } from '@xyflow/react';

export interface UpstreamRef {
  id:    string;
  label: string;
  type:  string;
}

/**
 * Return every ancestor of `nodeId` (transitive parents) in BFS order, closest
 * first. Used to populate the reference picker so the user only sees nodes
 * whose output is actually reachable as input.
 */
export function getUpstreamNodes(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): UpstreamRef[] {
  const seen   = new Set<string>();
  const out:   UpstreamRef[] = [];
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.target !== cur) continue;
      if (seen.has(e.source)) continue;
      seen.add(e.source);
      const n = nodes.find(nn => nn.id === e.source);
      if (!n) continue;
      const data  = (n.data ?? {}) as { label?: unknown };
      const label = typeof data.label === 'string' && data.label ? data.label : (n.type ?? n.id);
      out.push({ id: n.id, label, type: n.type ?? 'unknown' });
      queue.push(n.id);
    }
  }
  return out;
}

/**
 * Parse every `${...}` placeholder from a string and return a friendly
 * resolution against the supplied upstream refs.
 *
 * The unresolved placeholder still appears in the result so the UI can mark
 * it as "unknown" — that's the user's cue that they typed something stale or
 * the source node was deleted.
 */
export interface ResolvedRef {
  raw:      string;             // the original `${...}` substring including braces
  inner:    string;             // the content between the braces, trimmed
  baseKey:  string;             // the key before the first dot
  modifier: 'stdout' | 'exit' | 'label' | 'other';
  matched?: UpstreamRef;        // the upstream node it points to, if found
}

const PLACEHOLDER_RE = /\$\{\s*([^}]+?)\s*\}/g;

export function resolveRefs(text: string, upstream: UpstreamRef[]): ResolvedRef[] {
  const out: ResolvedRef[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    const inner = m[1].trim();
    const [head, ...rest] = inner.split('.');
    const suffix = rest.join('.');
    const modifier: ResolvedRef['modifier'] =
      !suffix || suffix === 'stdout' ? 'stdout'
      : suffix === 'exit' || suffix === 'exitCode' ? 'exit'
      : suffix === 'label' ? 'label'
      : 'other';

    let matched: UpstreamRef | undefined;
    if (head === 'prev') {
      matched = upstream[0];   // first direct ancestor is the closest "prev"
    } else {
      matched = upstream.find(u => u.id === head)
             ?? upstream.find(u => u.label === head);
    }
    out.push({ raw: m[0], inner, baseKey: head, modifier, matched });
  }
  return out;
}

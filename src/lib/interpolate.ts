/**
 * Variable interpolation for node inputs.
 *
 * Supported placeholders (all case-sensitive):
 *   ${prev}            joined stdout of all direct upstream parents
 *   ${prev.exit}       exit code of the most-recent parent
 *   ${<nodeId>}        captured stdout of the named node
 *   ${<label>}         captured stdout of the node whose label matches
 *   ${<id>.exit}       exit code of the named node
 *   ${env.NAME}        process env variable (read via import.meta.env on web)
 *   ${loop.item}       current forEach loop item (whole value)
 *   ${loop.item.field} JSON field extracted from the current forEach loop item
 *
 * Whitespace inside the braces is tolerated. Unknown placeholders are left
 * untouched so the user can spot typos.
 */

export interface NodeRunResult {
  id:       string;
  label:    string;
  stdout:   string;
  exitCode: number | null;
}

export interface InterpolationContext {
  /** Results of nodes that have already finished, keyed by node id. */
  results:   Map<string, NodeRunResult>;
  /** Direct upstream parents of the node being interpolated. */
  parents:   string[];
  /** Flow-level variables, resolved with ${var:NAME} syntax. */
  variables?: Record<string, string>;
  /** App-level secrets, resolved with ${secret:NAME} syntax. Masked in logs. */
  secrets?: Record<string, string>;
  /** Current forEach loop item, resolved with ${loop.item}. */
  loopItem?: string;
}

const PLACEHOLDER_RE = /\$\{\s*([^}]+?)\s*\}/g;

export function interpolate(text: string, ctx: InterpolationContext): string {
  if (!text || !text.includes('${')) return text;

  return text.replace(PLACEHOLDER_RE, (raw, expr: string) => {
    const key = expr.trim();
    if (!key) return raw;

    // ${var:NAME} — flow-level variables, resolved first
    if (key.startsWith('var:')) {
      const name = key.slice(4).trim();
      return ctx.variables?.[name] ?? raw;
    }

    // ${secret:NAME} — app-level secrets (global, masked in logs)
    if (key.startsWith('secret:')) {
      const name = key.slice(7).trim();
      return ctx.secrets?.[name] ?? raw;
    }

    // ${loop.item} — current forEach item (whole value)
    if (key === 'loop.item') {
      return ctx.loopItem !== undefined ? ctx.loopItem : raw;
    }

    // ${loop.item.field} — JSON field extraction from the current loop item
    if (key.startsWith('loop.item.')) {
      if (ctx.loopItem === undefined) return raw;
      const field = key.slice('loop.item.'.length);
      try {
        const parsed = JSON.parse(ctx.loopItem);
        const val = jsonPath(parsed, field.split('.'));
        if (val !== undefined) return typeof val === 'string' ? val : JSON.stringify(val);
      } catch { /* loop item is not JSON */ }
      return raw;
    }

    // ${prev} / ${prev.exit}
    if (key === 'prev' || key === 'prev.stdout') {
      return joinParentStdout(ctx);
    }
    if (key === 'prev.exit' || key === 'prev.exitCode') {
      const last = ctx.parents.length > 0
        ? ctx.results.get(ctx.parents[ctx.parents.length - 1])
        : undefined;
      return last?.exitCode != null ? String(last.exitCode) : '';
    }

    // ${env.NAME}
    if (key.startsWith('env.')) {
      const name = key.slice(4);
      const env  = (import.meta as { env?: Record<string, string> }).env ?? {};
      return env[name] ?? '';
    }

    // ${id} / ${id.exit} / ${id.stdout}
    const [head, ...rest] = key.split('.');
    const suffix = rest.join('.');
    const hit    = findResult(ctx.results, head);
    if (!hit) return raw;

    if (!suffix || suffix === 'stdout') return hit.stdout.trim();
    if (suffix === 'exit' || suffix === 'exitCode') {
      return hit.exitCode != null ? String(hit.exitCode) : '';
    }
    if (suffix === 'label') return hit.label;

    // ${node-id.field.nested} — JSON field extraction from stdout
    try {
      const parsed = JSON.parse(hit.stdout);
      const val = jsonPath(parsed, suffix.split('.'));
      if (val !== undefined) return typeof val === 'string' ? val : JSON.stringify(val);
    } catch { /* stdout is not JSON */ }
    return raw;
  });
}

function joinParentStdout(ctx: InterpolationContext): string {
  return ctx.parents
    .map(id => ctx.results.get(id)?.stdout?.trim() ?? '')
    .filter(Boolean)
    .join('\n');
}

function jsonPath(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function findResult(results: Map<string, NodeRunResult>, key: string): NodeRunResult | undefined {
  const byId = results.get(key);
  if (byId) return byId;
  // Fall back to a case-sensitive label match.
  for (const r of results.values()) {
    if (r.label === key) return r;
  }
  return undefined;
}

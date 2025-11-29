export function isPathish(token: string): boolean {
  // Windows: C:\..., C:/..., \\server\share
  if (/^[A-Za-z]:[\\/]/.test(token)) return true;
  if (/^\\\\/.test(token)) return true;

  // POSIX-ish: /..., ./..., ../..., ~/...
  if (/^(\/|\.{1,2}[\\/]|~[\\/])/.test(token)) return true;

  // Also accept quoted-looking tokens as pathish (already one argv token)
  if (/^["'].*["']$/.test(token)) return true;

  return false;
}

/**
 * Split a possibly-greedy -a/--args list into:
 *   - serverArgs (to pass to the MCP server)
 *   - tool (if found)
 *   - toolArgs
 *
 * Heuristic: collect pathish tokens and option-looking tokens (start with '-')
 * until we hit the first non-pathish, non-flag token → that's the tool name.
 */
export function splitServerArgsAndTool(
  flagArgs: string[] = [],
  explicitTool?: string,
  explicitToolArgs: string[] = []
): { serverArgs: string[]; tool?: string; toolArgs: string[] } {
  // If the user already supplied a positional tool, trust it.
  if (explicitTool) {
    return { serverArgs: flagArgs, tool: explicitTool, toolArgs: explicitToolArgs ?? [] };
  }

  const serverArgs: string[] = [];
  let i = 0;

  for (; i < flagArgs.length; i++) {
    const t = flagArgs[i];
    // Keep flags like --foo or -v (some servers accept options)
    if (t.startsWith('-') || isPathish(t)) {
      serverArgs.push(t);
      continue;
    }
    // First non-flag, non-pathish token → treat as tool name
    break;
  }

  const tool = flagArgs[i];
  const toolArgs = i < flagArgs.length ? flagArgs.slice(i + 1) : [];
  return { serverArgs, tool, toolArgs };
}

export function coerceByType(raw: string, schema?: any) {
  const t = schema?.type ?? 'string';
  if (t === 'number') return Number(raw);
  if (t === 'integer') return parseInt(raw, 10);
  if (t === 'boolean') return /^true$/i.test(raw);
  if (t === 'array') {
    try { return JSON.parse(raw); } catch { return raw.split(',').map(s => s.trim()); }
  }
  if (t === 'object') { try { return JSON.parse(raw); } catch {} }
  return raw;
}

export function parseCliArgsForTool(tool: any, argv: string[]) {
  const props: Record<string, any> = (tool.inputSchema?.properties ?? {}) as any;
  const required: string[] = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [];
  const keys = Object.keys(props);

  const kvArgs: Record<string, any> = {};
  const pos: string[] = [];

  for (const a of argv) {
    const i = a.indexOf('=');
    if (i > 0) {
      const k = a.slice(0, i);
      const v = a.slice(i + 1);
      kvArgs[k] = coerceByType(v, props[k]);
    } else {
      pos.push(a);
    }
  }

  const out: Record<string, any> = { ...kvArgs };

  // Single required key (e.g., 'path'): accept the whole remainder as one value (handles spaces)
  if (required.length === 1 && out[required[0]] === undefined && pos.length > 0) {
    out[required[0]] = coerceByType(pos.join(' '), props[required[0]]);
    pos.length = 0;
  }

  // If still nothing and property named 'path' exists, prefer mapping to it
  if (props.path && out.path === undefined && pos.length > 0) {
    if (keys.length === 1) {
      out.path = coerceByType(pos.join(' '), props.path);
      pos.length = 0;
    } else {
      out.path = coerceByType(pos.shift()!, props.path);
    }
  }

  // Fallback: map remaining by property order
  for (let i = 0; i < pos.length && i < keys.length; i++) {
    const k = keys[i];
    if (out[k] === undefined) out[k] = coerceByType(pos[i], props[k]);
  }

  // Validate required
  for (const r of required) {
    if (out[r] === undefined) {
      throw new Error(`Missing required parameter: ${r}`);
    }
  }
  return out;
}

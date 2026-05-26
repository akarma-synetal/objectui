// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tiny predicate evaluator for FormView `visibleOn` expressions.
 *
 * This is an interim stand-in for the full CEL runtime
 * (`@objectstack/formula`) — we keep it intentionally small so the
 * Setup admin engine has zero new runtime dependencies. When CEL is
 * unified across the platform (ROADMAP M9), swap `evaluatePredicate`
 * for the real CEL evaluator without touching SchemaForm.tsx.
 *
 * Supported subset (covers everything used in spec `*.form.ts` today):
 *   - `path == 'literal'`       string equality
 *   - `path != 'literal'`       string inequality
 *   - `path == 123`             number equality
 *   - `path == true|false`      boolean equality
 *   - `path in ['a','b']`       membership
 *   - `!path`                   negation (truthy)
 *   - `path`                    truthy check
 *   - `path && expr`            conjunction
 *   - `path || expr`            disjunction
 *
 * Paths support dot notation: `data.type`, `data.config.kind`.
 *
 * On any parse error → returns `true` (fail-open): better to show a
 * field than to silently hide it.
 */

export function evaluatePredicate(
  expr: string | { dialect?: string; source: string } | null | undefined,
  ctx: { data: Record<string, unknown> },
): boolean {
  if (expr == null) return true;
  const source = typeof expr === 'string' ? expr : expr.source;
  if (!source) return true;
  try {
    return evalExpr(source.trim(), ctx);
  } catch {
    return true;
  }
}

function evalExpr(
  expr: string,
  ctx: { data: Record<string, unknown> },
): boolean {
  // Handle || (lowest precedence)
  const orParts = splitTopLevel(expr, '||');
  if (orParts.length > 1) {
    return orParts.some((p) => evalExpr(p.trim(), ctx));
  }
  // Handle &&
  const andParts = splitTopLevel(expr, '&&');
  if (andParts.length > 1) {
    return andParts.every((p) => evalExpr(p.trim(), ctx));
  }
  // Handle negation
  if (expr.startsWith('!')) {
    return !evalExpr(expr.slice(1).trim(), ctx);
  }
  // Handle 'in'
  const inMatch = expr.match(/^(.+?)\s+in\s+(\[.*\])$/);
  if (inMatch) {
    const left = resolveValue(inMatch[1].trim(), ctx);
    const right = parseLiteral(inMatch[2]);
    return Array.isArray(right) && right.includes(left as never);
  }
  // Handle == / != (CEL-style loose equality: null == undefined)
  const eqMatch = expr.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (eqMatch) {
    const left = resolveValue(eqMatch[1].trim(), ctx);
    const right = parseLiteral(eqMatch[3].trim());
    const nullish = (v: unknown) => v === null || v === undefined;
    const equal = nullish(left) && nullish(right) ? true : left === right;
    return eqMatch[2] === '==' ? equal : !equal;
  }
  // Bare truthy check
  return Boolean(resolveValue(expr, ctx));
}

function splitTopLevel(expr: string, op: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let buf = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inStr) {
      buf += ch;
      if (ch === inStr && expr[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (
      depth === 0 &&
      expr.slice(i, i + op.length) === op &&
      // Not a sub-operator (e.g. == when looking for =)
      expr[i + op.length] !== '='
    ) {
      out.push(buf);
      buf = '';
      i += op.length - 1;
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

function resolveValue(
  path: string,
  ctx: { data: Record<string, unknown> },
): unknown {
  // Allow literals on the left side too.
  if (/^['"]/.test(path) || /^-?\d/.test(path) || path === 'true' || path === 'false' || path === 'null') {
    return parseLiteral(path);
  }
  const segs = path.split('.');
  let cur: any = ctx;
  for (const seg of segs) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function parseLiteral(raw: string): unknown {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    return s.slice(1, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      // JSON-parse after normalising single-quoted strings to double.
      const json = s.replace(/'([^']*)'/g, (_, inner) => JSON.stringify(inner));
      return JSON.parse(json);
    } catch {
      return [];
    }
  }
  return s;
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Preflight graph validation + CEL helpers for the flow simulator.
 *
 * Validation runs BEFORE a simulation so the debugger refuses to "Run" a
 * structurally broken flow (which the real runtime would reject) instead of
 * producing misleading partial output. Condition evaluation deliberately does
 * NOT swallow errors the way the shared `evaluatePlainCondition` does — a
 * debugger must tell the author *why* a branch was false (parse error, missing
 * variable, type error), so we capture and surface the message.
 */

import { ExpressionEvaluator } from '@object-ui/core';
import type { Diagnostic, FlowValidation, SimEdge, SimNode } from './flow-sim-types';

const edgeCondString = (c: SimEdge['condition']): string | undefined =>
  typeof c === 'string' ? c : undefined;

/** Evaluate a CEL condition, capturing (not swallowing) any failure. */
export function evalCondition(
  expr: string,
  variables: Record<string, unknown>,
): { result: boolean; error?: string } {
  const source = expr.trim();
  if (!source) return { result: false, error: 'Empty condition.' };
  try {
    const evaluator = new ExpressionEvaluator({ ...variables, data: variables });
    const isTemplate = /\$\{/.test(source);
    const raw = isTemplate
      ? evaluator.evaluate(source, { throwOnError: true })
      : evaluator.evaluateExpression(source);
    return { result: raw === true };
  } catch (err) {
    return { result: false, error: (err as Error).message || 'Evaluation failed.' };
  }
}

/** Static structural checks; `errors` block Run, `warnings` are advisory. */
export function validateFlowDraft(nodes: SimNode[], edges: SimEdge[]): FlowValidation {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  const ids = nodes.map((n) => n.id);
  const idSet = new Set<string>();
  for (const id of ids) {
    if (!id) {
      errors.push({ level: 'error', message: 'A node is missing an id.' });
      continue;
    }
    if (idSet.has(id)) errors.push({ level: 'error', nodeId: id, message: `Duplicate node id "${id}".` });
    idSet.add(id);
  }

  for (const e of edges) {
    if (!idSet.has(e.source)) errors.push({ level: 'error', message: `Edge source "${e.source}" does not exist.` });
    if (!idSet.has(e.target)) errors.push({ level: 'error', message: `Edge target "${e.target}" does not exist.` });
  }

  // Entry resolution: prefer an explicit `start` node, else a node with no
  // incoming edge. Zero or many → the author must fix it before running.
  const incoming = new Set(edges.map((e) => e.target));
  const startNodes = nodes.filter((n) => n.type === 'start');
  const roots = nodes.filter((n) => !incoming.has(n.id));
  let startNodeId: string | undefined;

  if (startNodes.length === 1) {
    startNodeId = startNodes[0].id;
    if (incoming.has(startNodeId)) {
      warnings.push({ level: 'warning', nodeId: startNodeId, message: 'Start node has an incoming edge.' });
    }
  } else if (startNodes.length > 1) {
    errors.push({ level: 'error', message: `Flow has ${startNodes.length} start nodes; expected one.` });
  } else if (roots.length === 1) {
    startNodeId = roots[0].id;
    warnings.push({ level: 'warning', nodeId: startNodeId, message: 'No "start" node; using the only root node as the entry.' });
  } else if (roots.length === 0) {
    errors.push({ level: 'error', message: 'No entry node (every node has an incoming edge — the graph is fully cyclic).' });
  } else {
    errors.push({ level: 'error', message: `Cannot determine a single entry node (${roots.length} candidates). Add a "start" node.` });
  }

  // Per-decision: at most one default; warn on missing default (possible dead end).
  for (const n of nodes) {
    if (n.type !== 'decision') continue;
    const out = edges.filter((e) => e.source === n.id);
    const defaults = out.filter((e) => e.isDefault);
    if (defaults.length > 1) {
      errors.push({ level: 'error', nodeId: n.id, message: `Decision "${n.id}" has ${defaults.length} default branches.` });
    }
    if (out.length === 0) {
      warnings.push({ level: 'warning', nodeId: n.id, message: `Decision "${n.id}" has no outgoing branches.` });
    } else if (defaults.length === 0 && out.every((e) => edgeCondString(e.condition))) {
      warnings.push({ level: 'warning', nodeId: n.id, message: `Decision "${n.id}" has no default branch; it may dead-end when no condition matches.` });
    }
  }

  // Unreachable nodes (advisory) — BFS from the resolved entry.
  if (startNodeId) {
    const reachable = new Set<string>([startNodeId]);
    const queue = [startNodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges) {
        if (e.source === cur && idSet.has(e.target) && !reachable.has(e.target)) {
          reachable.add(e.target);
          queue.push(e.target);
        }
      }
    }
    for (const n of nodes) {
      if (!reachable.has(n.id)) {
        warnings.push({ level: 'warning', nodeId: n.id, message: `Node "${n.id}" is unreachable from the entry.` });
      }
    }
  }

  return { errors, warnings, startNodeId };
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowPreview — read-only summary of a Flow metadata draft.
 *
 * A full DAG canvas lives in `@object-ui/plugin-designer` and would
 * pull in ReactFlow + its deps every time the metadata-admin loads,
 * which is too heavy for a glance-preview. Instead we render:
 *
 *   1. A header strip with type / status / runAs / version.
 *   2. A topologically ordered step list inferred from `nodes` +
 *      `edges`. Each step shows label, action type, branch markers,
 *      and outgoing edge conditions so authors can sanity-check the
 *      logic without launching the designer.
 *   3. A variables side panel listing declared flow variables.
 *
 * The renderer is defensive — drafts may be mid-edit with dangling
 * edges or duplicate node ids; we never throw, we just degrade.
 */

import * as React from 'react';
import {
  ArrowDown,
  CircleDot,
  CircleStop,
  Diamond,
  GitBranch,
  Play,
  Settings2,
  TimerReset,
  Variable,
  Workflow,
  Zap,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

interface FlowNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
}

interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | { source?: string };
  type?: string;
  label?: string;
  isDefault?: boolean;
}

interface FlowVariable {
  name: string;
  type?: string;
  defaultValue?: unknown;
  description?: string;
}

function nodeIcon(type: string) {
  switch (type) {
    case 'start':
      return Play;
    case 'end':
      return CircleStop;
    case 'decision':
    case 'branch':
    case 'gateway':
      return Diamond;
    case 'wait':
    case 'timer':
      return TimerReset;
    case 'boundary_event':
    case 'signal':
      return Zap;
    case 'subflow':
    case 'flow':
      return Workflow;
    default:
      return CircleDot;
  }
}

function conditionText(c: FlowEdge['condition']): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && typeof (c as any).source === 'string') return (c as any).source;
  return undefined;
}

/**
 * Topologically order nodes starting from the first `start` node (or
 * the first node) using BFS. Nodes unreachable from start are appended
 * at the end so the author still sees them.
 */
function orderNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }
  const startNode = nodes.find((n) => n.type === 'start') ?? nodes[0];
  const visited = new Set<string>();
  const out: FlowNode[] = [];
  const queue: string[] = [startNode.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node) out.push(node);
    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  for (const n of nodes) if (!visited.has(n.id)) out.push(n);
  return out;
}

export function FlowPreview({ draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const nodes: FlowNode[] = Array.isArray(d.nodes) ? (d.nodes as FlowNode[]) : [];
  const edges: FlowEdge[] = Array.isArray(d.edges) ? (d.edges as FlowEdge[]) : [];
  const variables: FlowVariable[] = Array.isArray(d.variables) ? (d.variables as FlowVariable[]) : [];

  const ordered = React.useMemo(() => orderNodes(nodes, edges), [nodes, edges]);
  const outgoingByNode = React.useMemo(() => {
    const map = new Map<string, FlowEdge[]>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, []);
      map.get(e.source)!.push(e);
    }
    return map;
  }, [edges]);
  const nodeById = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const flowType = String(d.type ?? 'autolaunched');
  const status = String(d.status ?? (d.active ? 'active' : 'draft'));
  const runAs = String(d.runAs ?? 'user');
  const version = d.version != null ? String(d.version) : undefined;
  const errorStrategy = (d.errorHandling as any)?.strategy as string | undefined;

  if (nodes.length === 0) {
    return (
      <PreviewShell hint="flow">
        <PreviewMessage>Add nodes in the Form tab to see the flow preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`flow · ${nodes.length} node${nodes.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary fallbackHint="One of the flow nodes or edges is malformed.">
        <div className="grid lg:grid-cols-[1fr_240px] gap-0">
          {/* Steps */}
          <div className="p-3 space-y-3 min-w-0">
            <div className="rounded border bg-muted/30 px-3 py-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
              <Pill icon={Zap} label="Trigger" value={flowType} />
              <Pill icon={CircleDot} label="Status" value={status} tone={status === 'active' ? 'green' : status === 'draft' ? 'gray' : 'amber'} />
              <Pill icon={Settings2} label="Run as" value={runAs} />
              {version && <Pill label="v" value={version} />}
              {errorStrategy && <Pill icon={GitBranch} label="On error" value={errorStrategy} />}
            </div>

            <ol className="space-y-2">
              {ordered.map((node, idx) => {
                const Icon = nodeIcon(node.type);
                const outs = outgoingByNode.get(node.id) ?? [];
                const isBranch = node.type === 'decision' || node.type === 'branch' || node.type === 'gateway';
                return (
                  <li key={node.id || idx} className="rounded border bg-background">
                    <div className="flex items-start gap-2 p-2.5">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-mono">
                        {idx + 1}
                      </span>
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium truncate">{node.label || node.id}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{node.id}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {node.type}
                          </span>
                        </div>
                        {summarizeNodeConfig(node) && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {summarizeNodeConfig(node)}
                          </div>
                        )}
                      </div>
                    </div>
                    {outs.length > 0 && (
                      <div className="border-t bg-muted/20 px-3 py-1.5 text-[11px] space-y-0.5">
                        {outs.map((e, i) => {
                          const cond = conditionText(e.condition);
                          const targetNode = nodeById.get(e.target);
                          const branchLabel = isBranch
                            ? e.isDefault
                              ? 'else'
                              : cond
                                ? `if ${cond}`
                                : e.label ?? 'branch'
                            : (e.label ?? (cond ? `when ${cond}` : 'next'));
                          return (
                            <div key={e.id || i} className="flex items-center gap-1.5">
                              <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-mono text-muted-foreground">{branchLabel}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium truncate">
                                {targetNode?.label || e.target}
                              </span>
                              {!targetNode && (
                                <span className="ml-1 text-amber-600">(unresolved)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Variables side panel */}
          <div className="border-l bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Variable className="h-3 w-3" /> Variables
            </div>
            {variables.length === 0 ? (
              <div className="text-muted-foreground italic">No variables declared.</div>
            ) : (
              <ul className="space-y-1.5">
                {variables.map((v, i) => (
                  <li key={v.name || i} className="rounded border bg-background p-1.5">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono">{v.name}</span>
                      {v.type && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {v.type}
                        </span>
                      )}
                    </div>
                    {v.defaultValue !== undefined && (
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        = {String(v.defaultValue)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function summarizeNodeConfig(node: FlowNode): string | undefined {
  const c = node.config as Record<string, unknown> | undefined;
  if (!c) return undefined;
  // Surface the most informative single-line bits.
  if (typeof c.objectName === 'string') return `object: ${c.objectName}`;
  if (typeof c.flowName === 'string') return `flow: ${c.flowName}`;
  if (typeof c.actionName === 'string') return `action: ${c.actionName}`;
  if (typeof c.eventType === 'string') return `event: ${c.eventType}`;
  if (typeof c.expression === 'string') return `expr: ${c.expression}`;
  const keys = Object.keys(c).slice(0, 3);
  return keys.length ? keys.map((k) => `${k}`).join(', ') : undefined;
}

function Pill({
  icon: Icon,
  label,
  value,
  tone = 'gray',
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'gray' | 'green' | 'amber';
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </span>
  );
}

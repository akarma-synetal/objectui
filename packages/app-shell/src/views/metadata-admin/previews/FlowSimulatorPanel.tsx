// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowSimulatorPanel — the designer-time debug runner UI. Drives a
 * `FlowSimulator` (pure engine) and lifts its highlight state up so the canvas
 * can paint the active node / traversed edges. Side effects are mocked; the
 * panel only collects the flow's input variables as the run seed.
 */

import * as React from 'react';
import { Play, StepForward, RotateCcw, ChevronRight, AlertTriangle, CircleAlert } from 'lucide-react';
import { Button, Input, Label, cn } from '@object-ui/components';
import { FlowSimulator } from './simulator/flow-simulator';
import type { FlowValidation, SimEdge, SimNode, SimState, SimStep } from './simulator/flow-sim-types';

export interface FlowVariableDecl {
  name: string;
  type?: string;
  defaultValue?: unknown;
  isInput?: boolean;
}

export interface FlowSimulatorPanelProps {
  nodes: SimNode[];
  edges: SimEdge[];
  variables: FlowVariableDecl[];
  onRunStateChange?: (s: { activeNodeId: string | null; visitedNodeIds: string[]; traversedEdgeIds: string[] } | null) => void;
}

/** Coerce a free-text seed value: number / boolean / JSON object|array / string. */
function parseSeed(raw: string): unknown {
  const s = raw.trim();
  if (s === '') return undefined;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try {
      return JSON.parse(s);
    } catch {
      return raw;
    }
  }
  return raw;
}

const STATUS_TONE: Record<SimStep['status'], string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  mocked: 'bg-violet-100 text-violet-700',
  paused: 'bg-amber-100 text-amber-700',
  skipped: 'bg-zinc-100 text-zinc-600',
  error: 'bg-rose-100 text-rose-700',
};

export function FlowSimulatorPanel({ nodes, edges, variables, onRunStateChange }: FlowSimulatorPanelProps) {
  const simRef = React.useRef<FlowSimulator | null>(null);
  const [snapshot, setSnapshot] = React.useState<SimState | null>(null);
  const [validation, setValidation] = React.useState<FlowValidation | null>(null);
  const inputs = React.useMemo(() => variables.filter((v) => v.isInput), [variables]);
  const [seed, setSeed] = React.useState<Record<string, string>>({});

  const sync = React.useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const st = sim.state;
    setSnapshot({
      ...st,
      steps: [...st.steps],
      variables: { ...st.variables },
      frontier: [...st.frontier],
      visitedNodeIds: [...st.visitedNodeIds],
      traversedEdgeIds: [...st.traversedEdgeIds],
    });
    onRunStateChange?.({
      activeNodeId: st.activeNodeId,
      visitedNodeIds: [...st.visitedNodeIds],
      traversedEdgeIds: [...st.traversedEdgeIds],
    });
  }, [onRunStateChange]);

  const buildSeed = React.useCallback((): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const v of inputs) {
      const raw = seed[v.name];
      const parsed = raw != null ? parseSeed(raw) : undefined;
      out[v.name] = parsed !== undefined ? parsed : v.defaultValue;
    }
    return out;
  }, [inputs, seed]);

  const reset = React.useCallback(() => {
    const sim = new FlowSimulator(nodes, edges);
    simRef.current = sim;
    setValidation(sim.reset(buildSeed(), {}));
    sync();
  }, [nodes, edges, buildSeed, sync]);

  const ensure = React.useCallback(() => {
    if (!simRef.current) reset();
    return simRef.current!;
  }, [reset]);

  const onRun = () => {
    const sim = simRef.current ?? (reset(), simRef.current!);
    sim.runToEnd();
    sync();
  };
  const onStep = () => {
    const sim = ensure();
    sim.step();
    sync();
  };
  const onResume = () => {
    const sim = ensure();
    sim.resume();
    sim.runToEnd();
    sync();
  };
  const onReset = () => {
    simRef.current = null;
    setSnapshot(null);
    setValidation(null);
    onRunStateChange?.(null);
  };

  const status = snapshot?.status ?? 'idle';
  const blocked = (validation?.errors.length ?? 0) > 0;

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-2">
        <Button size="sm" className="h-7 gap-1 px-2" onClick={onRun} disabled={blocked}>
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={onStep} disabled={blocked || status === 'done' || status === 'error'}>
          <StepForward className="h-3.5 w-3.5" /> Step
        </Button>
        {status === 'paused' && (
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={onResume}>
            <ChevronRight className="h-3.5 w-3.5" /> Continue
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-muted-foreground" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
        <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', STATUS_TONE[status === 'idle' || status === 'running' ? 'ok' : (status as SimStep['status'])] ?? 'bg-muted')}>
          {status}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {/* Validation diagnostics */}
        {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-1">
            {validation.errors.map((d, i) => (
              <div key={`e${i}`} className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
                <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{d.message}</span>
              </div>
            ))}
            {validation.warnings.map((d, i) => (
              <div key={`w${i}`} className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{d.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Seed inputs */}
        {inputs.length > 0 && (
          <section className="space-y-1.5">
            <div className="font-medium text-muted-foreground">Inputs</div>
            {inputs.map((v) => (
              <div key={v.name} className="flex items-center gap-2">
                <Label className="w-24 shrink-0 truncate font-mono text-[11px]" title={v.name}>{v.name}</Label>
                <Input
                  value={seed[v.name] ?? (v.defaultValue != null ? String(v.defaultValue) : '')}
                  onChange={(e) => setSeed((p) => ({ ...p, [v.name]: e.target.value }))}
                  placeholder={v.type ?? 'value'}
                  className="h-7 flex-1 text-xs"
                />
              </div>
            ))}
          </section>
        )}

        {/* Variable watch */}
        {snapshot && (
          <section className="space-y-1.5">
            <div className="font-medium text-muted-foreground">Variables</div>
            {Object.keys(snapshot.variables).length === 0 ? (
              <div className="italic text-muted-foreground">No variables set.</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(snapshot.variables).map(([k, val]) => (
                  <li key={k} className="flex items-baseline gap-1.5 rounded border bg-background px-1.5 py-1">
                    <span className="font-mono text-[11px]">{k}</span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      = {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Step timeline */}
        {snapshot && snapshot.steps.length > 0 && (
          <section className="space-y-1.5">
            <div className="font-medium text-muted-foreground">Timeline</div>
            <ol className="space-y-1">
              {snapshot.steps.map((s) => (
                <li key={s.seq} className="rounded border bg-background p-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">{s.seq + 1}</span>
                    <span className="truncate font-medium">{s.label}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{s.type}</span>
                    <span className={cn('ml-auto rounded px-1 py-0.5 text-[9px] font-semibold uppercase', STATUS_TONE[s.status])}>
                      {s.status}
                    </span>
                  </div>
                  {s.note && <div className="mt-0.5 text-[10px] text-muted-foreground">{s.note}</div>}
                  {s.error && <div className="mt-0.5 text-[10px] text-rose-600">{s.error}</div>}
                  {s.wrote && (
                    <div className="mt-0.5 truncate font-mono text-[10px] text-violet-600">
                      → {Object.keys(s.wrote).join(', ')}
                    </div>
                  )}
                  {s.edges && s.edges.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {s.edges.map((ed) => (
                        <li key={ed.edgeId} className={cn('flex items-center gap-1 font-mono text-[10px]', ed.selected ? 'text-sky-700' : 'text-muted-foreground')}>
                          <span>{ed.selected ? '▶' : '·'}</span>
                          <span className="truncate">{ed.isDefault ? 'else' : ed.condition}</span>
                          <span className="ml-auto">{ed.error ? '⚠' : ed.result ? 'true' : 'false'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {!snapshot && !blocked && (
          <p className="italic text-muted-foreground">Press Run to simulate, or Step to walk node by node. Side effects are mocked — no backend is called.</p>
        )}
      </div>
    </div>
  );
}

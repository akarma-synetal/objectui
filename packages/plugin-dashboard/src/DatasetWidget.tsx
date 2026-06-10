// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetWidget — renders a dashboard widget that binds to a semantic-layer
 * `dataset` (ADR-0021) instead of an inline `object` + `valueField` query.
 *
 * It selects the dataset's dimensions/measures BY NAME and runs them through
 * `dataSource.queryDataset` — the same governed path the dataset preview and
 * dataset-bound reports use — so the numbers match everywhere. A `metric`
 * widget shows the single measure value; other types render a bar chart via the
 * shared chart registry (`bar-chart`). Errors surface instead of silently
 * showing wrong/empty numbers.
 *
 * Field access goes through `as any` because the bundled `@object-ui/types`
 * `DashboardWidgetSchema` only gains `dataset`/`dimensions`/`values` once
 * objectui bumps its `@objectstack/spec` dependency (cross-repo spec skew).
 */

import { useEffect, useMemo, useState } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { cn } from '@object-ui/components';
import { Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { resolveDateMacros } from './utils';

type Row = Record<string, unknown>;
interface DatasetCapableSource {
  queryDataset?: (dataset: string, selection: unknown) => Promise<{ rows: Row[] }>;
}

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}

export function DatasetWidget({ widget, dataSource }: { widget: any; dataSource: unknown }) {
  const datasetName = String(widget?.dataset ?? '');
  const dimensions: string[] = useMemo(() => (Array.isArray(widget?.dimensions) ? widget.dimensions.filter(Boolean) : []), [widget]);
  const values: string[] = useMemo(() => (Array.isArray(widget?.values) ? widget.values.filter(Boolean) : []), [widget]);
  const compareTo = widget?.compareTo;
  const isMetric = widget?.type === 'metric' || dimensions.length === 0;

  // ADR-0021 dual-form: the widget's presentation-scope `filter` must flow into
  // the dataset query as `runtimeFilter`, or a dataset-bound widget renders the
  // UNFILTERED total (e.g. "open pipeline" showing the grand total). Resolve
  // date macros client-side first — exactly as the legacy widget renderers do
  // (the server does not expand `{current_quarter_start}` etc.). Keyed on the
  // raw filter ref so the resolution is stable across renders.
  const rawFilter = widget?.filter;
  const runtimeFilter = useMemo(
    () => (rawFilter && typeof rawFilter === 'object' && Object.keys(rawFilter).length > 0
      ? resolveDateMacros(rawFilter)
      : undefined),
    [rawFilter],
  );

  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Row[]; error?: string }>({ status: 'idle', rows: [] });

  // Signature uses the RAW filter (stable) — the resolved one carries a
  // render-time `now` and would otherwise force a refetch loop.
  const signature = `${datasetName}|${dimensions.join(',')}|${values.join(',')}|${JSON.stringify(rawFilter ?? null)}|${JSON.stringify(compareTo ?? null)}`;
  useEffect(() => {
    const src = dataSource as DatasetCapableSource | undefined;
    if (!src || typeof src.queryDataset !== 'function') {
      setState({ status: 'error', rows: [], error: 'This data source does not support dataset queries.' });
      return;
    }
    if (values.length === 0) { setState({ status: 'idle', rows: [] }); return; }
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    src.queryDataset(datasetName, {
      dimensions,
      measures: values,
      ...(runtimeFilter ? { runtimeFilter } : {}),
      ...(compareTo ? { compareTo } : {}),
    })
      .then((res) => { if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [] }); })
      .catch((e) => { if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (values.length === 0) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">Pick measures (values) for this dataset widget.</div>;
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="flex h-full w-full items-center justify-center p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="flex h-full w-full items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span className="break-words">{state.error}</span>
      </div>
    );
  }
  if (state.rows.length === 0) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground"><BarChart3 className="mr-2 h-4 w-4" />No rows</div>;
  }

  // Metric / KPI — show the single measure value of the first row.
  if (isMetric) {
    const value = state.rows[0]?.[values[0]];
    return (
      <div className="flex h-full w-full flex-col items-start justify-center gap-1 p-2">
        <span className="text-2xl font-semibold tabular-nums">{formatValue(value)}</span>
        <span className="text-xs text-muted-foreground">{values[0]}</span>
      </div>
    );
  }

  // Chart — bar chart of the first measure over the first dimension, via the
  // shared chart registry (`bar-chart`).
  return (
    <div className={cn('h-full w-full min-h-[220px]')}>
      <SchemaRenderer
        schema={{ type: 'bar-chart', data: state.rows, xAxisKey: dimensions[0], dataKey: values[0] } as any}
      />
    </div>
  );
}

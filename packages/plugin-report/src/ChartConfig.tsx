/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Checkbox } from '@object-ui/components';
import type { AvailableField, Translator } from './editorTypes';
import { NONE, NUMERIC_TYPES } from './editorTypes';

// ---------------------------------------------------------------------------
// ChartConfig — chart subset (type / title / axes / legend / data labels)
// ---------------------------------------------------------------------------

export function ChartConfig({
  availableFields,
  columns,
  value,
  onChange,
  t,
}: {
  availableFields: AvailableField[];
  columns: ColumnDraft[];
  value: any;
  onChange: (v: any) => void;
  t: Translator;
}) {
  const chart = value || {};
  const chartType = chart.type ?? chart.chartType ?? '';
  const xAxis = chart.xAxis ?? chart.xAxisField ?? '';
  const yAxis = chart.yAxis ?? chart.yAxisFields?.[0] ?? '';

  const updateChart = (updates: any) => {
    const next: any = { ...chart, ...updates };
    if ('type' in updates) delete next.chartType;
    if ('xAxis' in updates) delete next.xAxisField;
    if ('yAxis' in updates) delete next.yAxisFields;
    if (!updates.type && updates.type === '') return onChange(undefined);
    onChange(next);
  };

  const clearChart = () => onChange(undefined);

  const chartTypeOptions = [
    { value: NONE, label: t('report.editor.chartNone') },
    { value: 'bar', label: t('report.editor.chartBar') },
    { value: 'line', label: t('report.editor.chartLine') },
    { value: 'area', label: t('report.editor.chartArea') },
    { value: 'pie', label: t('report.editor.chartPie') },
    { value: 'donut', label: t('report.editor.chartDonut') },
    { value: 'funnel', label: t('report.editor.chartFunnel') },
  ];

  // Y-axis candidates: aggregated columns first, then numeric raw fields.
  const aggregatedFields = columns.filter((c) => c.aggregate).map((c) => c.field);
  const numericFields = availableFields
    .filter((f) => NUMERIC_TYPES.has(f.type ?? ''))
    .map((f) => f.value);
  const ySet = new Set<string>([...aggregatedFields, ...numericFields]);
  const yOptions = availableFields.filter((f) => ySet.has(f.value));

  return (
    <div className="space-y-2 py-1" data-testid="chart-config">
      <div>
        <label className="text-[10px] text-muted-foreground">{t('report.editor.chartType')}</label>
        <select
          className="w-full h-7 text-xs border rounded px-2 bg-background"
          value={chartType}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) clearChart();
            else updateChart({ type: v });
          }}
          data-testid="chart-type-select"
        >
          {chartTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {chartType && (
        <>
          <div>
            <label className="text-[10px] text-muted-foreground">{t('report.editor.chartTitle')}</label>
            <input
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={chart.title ?? ''}
              placeholder={t('report.editor.chartTitlePlaceholder')}
              onChange={(e) => updateChart({ title: e.target.value || undefined })}
              data-testid="chart-title"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">{t('report.editor.chartXAxis')}</label>
            <select
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={xAxis}
              onChange={(e) => updateChart({ xAxis: e.target.value || undefined })}
              data-testid="chart-x-field"
            >
              <option value="">—</option>
              {availableFields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">{t('report.editor.chartYAxis')}</label>
            <select
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={yAxis}
              onChange={(e) => updateChart({ yAxis: e.target.value || undefined })}
              data-testid="chart-y-field"
            >
              <option value="">—</option>
              {(yOptions.length > 0 ? yOptions : availableFields).map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[10px]">
            <Checkbox
              checked={chart.showLegend !== false}
              onCheckedChange={(v) => updateChart({ showLegend: v === true })}
              data-testid="chart-show-legend"
            />
            <span>{t('report.editor.chartShowLegend')}</span>
          </label>
          <label className="flex items-center gap-2 text-[10px]">
            <Checkbox
              checked={!!chart.showDataLabels}
              onCheckedChange={(v) => updateChart({ showDataLabels: v === true })}
              data-testid="chart-show-data-labels"
            />
            <span>{t('report.editor.chartShowDataLabels')}</span>
          </label>
        </>
      )}
    </div>
  );
}


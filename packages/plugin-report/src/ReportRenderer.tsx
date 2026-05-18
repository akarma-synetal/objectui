/**
 * ReportRenderer
 *
 * Thin dispatcher that routes a report schema to the correct renderer based
 * on whether it is a spec-native `SpecReport` (preferred) or a legacy
 * presentation-layer schema (`data`/`columns`/`chart`).
 *
 * Dispatch table:
 * | report.type            | Renderer                          |
 * |------------------------|-----------------------------------|
 * | tabular | summary      | <SpecReportGrid>                  |
 * | matrix                 | placeholder (M2)                  |
 * | joined                 | placeholder (M3)                  |
 * | (legacy / no type)     | <LegacyReportRenderer>            |
 *
 * Host apps can:
 * - Pass a `SpecReport` plus a `dataSource` to drive a live, drillable report.
 * - Pass a legacy `{ data, columns, chart }` schema for backwards compatibility.
 */

import * as React from 'react';
import type { ActionRunner } from '@object-ui/core';
import { isSpecReport, type SpecReport, type DataSource } from '@object-ui/types';
import { LegacyReportRenderer, type LegacyReportRendererProps } from './LegacyReportRenderer';
import { SpecReportGrid } from './SpecReportGrid';
import { MatrixRenderer } from './MatrixRenderer';
import type { DrillOpenIn, DrillView } from './drill';

export type ReportRendererSchema = SpecReport | LegacyReportRendererProps['schema'];

export interface ReportRendererProps {
  /** Either a spec-native `SpecReport` or a legacy presentation schema. */
  schema: ReportRendererSchema;
  /** Required for spec reports unless `rows` is provided. */
  dataSource?: DataSource | Record<string, unknown>;
  /** Pre-fetched rows (skips data fetch). */
  rows?: Array<Record<string, unknown>>;
  /** Runtime filter merged on top of `report.filter`. */
  runtimeFilter?: Record<string, unknown>;
  /** Action runner used to dispatch `drill` actions on row click. */
  actionRunner?: ActionRunner;
  /** Default view for drill targets. */
  drillView?: DrillView;
  /** Where the drill target should open. */
  drillOpenIn?: DrillOpenIn;
  /** Optional class for the outer container. */
  className?: string;
}

const PLACEHOLDER_BANNER: React.CSSProperties = {
  border: '1px dashed var(--color-border, #d4d4d8)',
  borderRadius: 8,
  padding: 16,
  color: 'var(--color-muted-foreground, #71717a)',
  background: 'var(--color-muted, #f4f4f5)',
  fontSize: 13,
};

export const ReportRenderer: React.FC<ReportRendererProps> = ({
  schema,
  dataSource,
  rows,
  runtimeFilter,
  actionRunner,
  drillView,
  drillOpenIn,
  className,
}) => {
  if (isSpecReport(schema)) {
    const reportType = schema.type ?? 'tabular';

    if (reportType === 'matrix') {
      return (
        <MatrixRenderer
          report={schema}
          dataSource={dataSource as DataSource | undefined}
          rows={rows}
          runtimeFilter={runtimeFilter}
          actionRunner={actionRunner}
          drillView={drillView}
          drillOpenIn={drillOpenIn}
          className={className}
        />
      );
    }
    if (reportType === 'joined') {
      return (
        <div className={className} style={PLACEHOLDER_BANNER} data-testid="report-joined-placeholder">
          Joined report (<code>{schema.name}</code>) is not yet supported. Coming in M3.
        </div>
      );
    }

    return (
      <SpecReportGrid
        report={schema}
        dataSource={dataSource as DataSource | undefined}
        rows={rows}
        runtimeFilter={runtimeFilter}
        actionRunner={actionRunner}
        drillView={drillView}
        drillOpenIn={drillOpenIn}
        className={className}
      />
    );
  }

  // Legacy path — preserves backwards compatibility with the pre-spec schema.
  return <LegacyReportRenderer schema={schema as LegacyReportRendererProps['schema']} />;
};

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
import {
  isJoinedSpecReport,
  isSpecReport,
  type JoinedSpecReport,
  type SpecReport,
  type DataSource,
} from '@object-ui/types';
import { SchemaRendererContext } from '@object-ui/react';
import { LegacyReportRenderer, type LegacyReportRendererProps } from './LegacyReportRenderer';
import { SpecReportGrid } from './SpecReportGrid';
import { MatrixRenderer } from './MatrixRenderer';
import { JoinedReportRenderer } from './JoinedReportRenderer';
import { DatasetReportRenderer, isDatasetReport } from './DatasetReportRenderer';
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

export const ReportRenderer: React.FC<ReportRendererProps> = (props) => {
  const {
    dataSource: propDataSource,
    rows,
    runtimeFilter,
    actionRunner,
    drillView,
    drillOpenIn,
    className,
  } = props;
  // Fall back to the SchemaRenderer context when no dataSource prop is
  // supplied. This happens when ReportRenderer is dispatched through
  // <SchemaRenderer schema={{ type: 'spec-report', ... }} /> (e.g. from
  // the dashboard drill-down drawer), which does not forward runtime
  // context as props. Without this fallback the report cannot fetch
  // data and the matrix renders empty cells.
  const context = React.useContext(SchemaRendererContext);
  const dataSource = (propDataSource ?? context?.dataSource) as
    | DataSource
    | Record<string, unknown>
    | undefined;
  let schema = props.schema;
  // Unwrap SchemaRenderer wrapper: { type: 'spec-report', report: {...real spec report...} }.
  // SchemaRenderer registry dispatches on the outer `type`; the actual spec
  // report (with its own `type: 'matrix' | 'joined' | ...`) lives under `report`.
  if (
    schema && typeof schema === 'object'
    && (schema as Record<string, unknown>).type === 'spec-report'
    && (schema as Record<string, unknown>).report
    && typeof (schema as Record<string, unknown>).report === 'object'
  ) {
    schema = (schema as Record<string, unknown>).report as ReportRendererSchema;
  }
  // ADR-0021 single-form: a report bound to a semantic-layer `dataset` (rather
  // than an inline `objectName` + `columns` query) renders through the dataset
  // path — `queryDataset` + a grouped table — exactly like a dataset-bound
  // dashboard widget. Checked BEFORE the legacy `isSpecReport` guards, which
  // require `objectName`/`columns` and would otherwise drop a dataset report
  // into the legacy renderer (→ blank).
  if (isDatasetReport(schema)) {
    return (
      <DatasetReportRenderer
        report={schema as Parameters<typeof DatasetReportRenderer>[0]['report']}
        dataSource={dataSource}
        runtimeFilter={runtimeFilter}
        className={className}
      />
    );
  }
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
      if (isJoinedSpecReport(schema)) {
        return (
          <JoinedReportRenderer
            report={schema as JoinedSpecReport}
            dataSource={dataSource as DataSource | undefined}
            runtimeFilter={runtimeFilter}
            actionRunner={actionRunner}
            drillView={drillView}
            drillOpenIn={drillOpenIn}
            className={className}
          />
        );
      }
      return (
        <div className={className} style={PLACEHOLDER_BANNER} data-testid="report-joined-placeholder">
          Joined report (<code>{schema.name}</code>) is missing a <code>blocks</code> array.
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

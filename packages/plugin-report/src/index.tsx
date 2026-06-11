/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ReportRenderer } from './ReportRenderer';
import { LegacyReportRenderer } from './LegacyReportRenderer';
import { ReportViewer } from './ReportViewer';
import { DatasetReportRenderer, isDatasetReport } from './DatasetReportRenderer';

export { ReportRenderer, LegacyReportRenderer, ReportViewer, DatasetReportRenderer, isDatasetReport };
export type { ReportRendererProps, ReportRendererSchema } from './ReportRenderer';
export type { LegacyReportRendererProps } from './LegacyReportRenderer';
export type { DatasetReportRendererProps } from './DatasetReportRenderer';
export { formatValue } from './formatValue';
export { exportReport, exportAsCSV, exportAsJSON, exportAsHTML, exportAsPDF, exportAsExcel } from './ReportExportEngine';
export {
  exportWithLiveData,
  exportExcelWithFormulas,
  createScheduleTrigger,
} from './LiveReportExporter';
export type {
  LiveExportOptions,
  LiveExportResult,
  ExcelColumnConfig,
  ScheduleTriggerCallback,
} from './LiveReportExporter';

// Report execution helpers.
//
// `mergeFilters` is the shared scope-filter combinator used by the dataset
// renderer. The `useReportData` hook and its aggregation helpers implement
// the pre-9.0 CLIENT-SIDE pipeline (inline columns/groupings) — they are kept
// exported for stored-JSON consumers during the migration window, but new
// code should bind a dataset and let the semantic layer aggregate.
export {
  useReportData,
  columnKey,
  bucketDate,
  groupingValue,
  aggregateRows,
  groupAndAggregate,
  pivotRows,
  buildAggregateQuery,
  mergeFilters,
  collectFields,
} from './hooks/useReportData';
export type {
  ReportRow,
  PivotHeader,
  PivotMatrix,
  UseReportDataResult,
  UseReportDataOptions,
} from './hooks/useReportData';

// Register report component (dispatches dataset-bound vs legacy automatically)
ComponentRegistry.register(
  'report',
  ReportRenderer,
  {
    namespace: 'report',
    label: 'Report',
    category: 'Report',
    inputs: [
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'description', type: 'string', label: 'Description' },
        { name: 'chart', type: 'code', label: 'Chart Configuration' },
    ]
  }
);

// Spec-native alias — same dispatcher, explicit name for spec-driven hosts.
ComponentRegistry.register(
  'spec-report',
  ReportRenderer,
  {
    namespace: 'report',
    label: 'Spec Report',
    category: 'Report',
    inputs: [
        { name: 'dataset', type: 'string', label: 'Dataset' },
        { name: 'type', type: 'string', label: 'Report Type' },
    ]
  }
);

// Register report viewer component
ComponentRegistry.register(
  'report-viewer',
  ReportViewer,
  {
    namespace: 'report',
    label: 'Report Viewer',
    category: 'Report',
    inputs: [
        { name: 'report', type: 'code', label: 'Report Definition' },
        { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar' }
    ]
  }
);

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
export type { DatasetReportRendererProps, DatasetDrillArgs } from './DatasetReportRenderer';
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

// `mergeFilters` — the scope-filter combinator shared by the dataset report
// path. The pre-9.0 client-side aggregation pipeline (`useReportData` + its
// `buildAggregateQuery`/`groupAndAggregate`/`pivotRows`/… helpers) was removed
// with ADR-0021: dataset-bound reports aggregate in the semantic layer via
// `queryDataset`, so the client-side path had no remaining consumers.
export { mergeFilters } from './mergeFilters';

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

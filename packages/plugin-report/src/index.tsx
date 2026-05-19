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
import { ReportBuilder } from './ReportBuilder';
import { ReportConfigPanel } from './ReportConfigPanel';
import { SpecReportGrid } from './SpecReportGrid';
import { MatrixRenderer } from './MatrixRenderer';
import { JoinedReportRenderer } from './JoinedReportRenderer';

export { ReportRenderer, LegacyReportRenderer, ReportViewer, ReportBuilder, ReportConfigPanel, SpecReportGrid, MatrixRenderer, JoinedReportRenderer };
export type { ReportRendererProps, ReportRendererSchema } from './ReportRenderer';
export type { LegacyReportRendererProps } from './LegacyReportRenderer';
export type { SpecReportGridProps } from './SpecReportGrid';
export type { MatrixRendererProps, MatrixCellClickArgs } from './MatrixRenderer';
export type { JoinedReportRendererProps } from './JoinedReportRenderer';
export {
  buildDrillAction,
  createDrillHandler,
  registerDrillHandler,
  isDrillAction,
} from './drill';
export type {
  DrillActionDef,
  DrillHandlerOptions,
  DrillNavigateTarget,
  DrillOpenIn,
  DrillView,
} from './drill';
export type { AvailableField } from './ReportConfigPanel';
export { JoinedBlocksEditor, validateJoinedBlocks } from './JoinedBlocksEditor';
export type { JoinedBlocksEditorProps } from './JoinedBlocksEditor';
export { formatValue } from './formatValue';
export { exportReport, exportAsCSV, exportAsJSON, exportAsHTML, exportAsPDF, exportAsExcel } from './ReportExportEngine';
export { ScheduleConfig } from './ScheduleConfig';
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

// Spec-native report execution
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

// Register report component (dispatches spec vs legacy automatically)
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
        { name: 'objectName', type: 'string', label: 'Object Name' },
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

// Register report builder component
ComponentRegistry.register(
  'report-builder',
  ReportBuilder,
  {
    namespace: 'report',
    label: 'Report Builder',
    category: 'Report',
    inputs: [
        { name: 'report', type: 'code', label: 'Initial Report' },
    ]
  }
);

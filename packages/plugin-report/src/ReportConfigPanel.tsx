/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConfigPanelRenderer,
  useConfigDraft,
} from '@object-ui/components';
import type { ConfigPanelSchema, ConfigSection } from '@object-ui/components';
import { AlertTriangle } from 'lucide-react';
import { JoinedBlocksEditor, validateJoinedBlocks } from './JoinedBlocksEditor';
import type { AvailableField, Translator } from './editorTypes';
import { SpecFilterAdapter } from './specFilterAdapter';
import { ColumnsEditor } from './ColumnsEditor';
import { GroupingsBuilder } from './GroupingsBuilder';
import { ChartConfig } from './ChartConfig';

// Re-export sub-builders so existing consumers (tests, JoinedBlocksEditor,
// downstream packages) keep importing from './ReportConfigPanel'.
export type { AvailableField } from './editorTypes';
export {
  specFilterToUIGroup,
  uiGroupToSpecFilter,
  SpecFilterAdapter,
} from './specFilterAdapter';
export type { SpecFilterParseResult } from './specFilterAdapter';
export { ColumnsEditor, normalizeColumns } from './ColumnsEditor';
import { normalizeColumns } from './ColumnsEditor';
export { GroupingsBuilder } from './GroupingsBuilder';
export { ChartConfig } from './ChartConfig';

// ---------------------------------------------------------------------------
// Schema builder — type-driven sections
// ---------------------------------------------------------------------------

function buildReportSchema(
  availableFields: AvailableField[],
  t: Translator,
  getFieldsForObject?: (objectName: string | undefined) => AvailableField[] | undefined,
): ConfigPanelSchema {
  const isSummary = (d: Record<string, any>) => d.type === 'summary';
  const isMatrix = (d: Record<string, any>) => d.type === 'matrix';
  const supportsChart = (d: Record<string, any>) => d.type === 'summary' || d.type === 'matrix';

  const sections: ConfigSection[] = [
    {
      key: 'basic',
      title: t('report.editor.basic'),
      fields: [
        {
          key: 'label',
          label: t('report.editor.title'),
          type: 'input',
          placeholder: t('report.editor.titlePlaceholder'),
        },
        {
          key: 'description',
          label: t('report.editor.description'),
          type: 'textarea',
          placeholder: t('report.editor.descriptionPlaceholder'),
        },
        {
          key: 'type',
          label: t('report.editor.type'),
          type: 'select',
          defaultValue: 'tabular',
          options: [
            { value: 'tabular', label: t('report.editor.typeTabular') },
            { value: 'summary', label: t('report.editor.typeSummary') },
            { value: 'matrix', label: t('report.editor.typeMatrix') },
            { value: 'joined', label: t('report.editor.typeJoined') },
          ],
          helpText: t('report.editor.typeHelp'),
        },
      ],
    },
    {
      key: 'data',
      title: t('report.editor.data'),
      collapsible: true,
      fields: [
        {
          key: 'objectName',
          label: t('report.editor.objectName'),
          type: 'input',
          placeholder: t('report.editor.objectNamePlaceholder'),
          helpText: t('report.editor.objectNameHelp'),
        },
        {
          key: 'limit',
          label: t('report.editor.limit'),
          type: 'input',
          placeholder: t('report.editor.limitPlaceholder'),
        },
      ],
    },
    // Row groupings — placed BEFORE measures so users editing a matrix/summary
    // see the report's pivot structure first, not the cell values.
    {
      key: 'rows',
      title: t('report.editor.rows'),
      collapsible: true,
      hint: t('report.editor.rowsHint'),
      visibleWhen: (d) => isSummary(d) || isMatrix(d),
      fields: [
        {
          key: 'groupingsDown',
          label: t('report.editor.grouping'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <GroupingsBuilder availableFields={availableFields} value={value} onChange={onChange} t={t} testIdPrefix="rows-grouping" />
          ),
        },
      ],
    },
    // Column groupings — matrix only.
    {
      key: 'columnsAxis',
      title: t('report.editor.columnsAxis'),
      collapsible: true,
      hint: t('report.editor.columnsAxisHint'),
      visibleWhen: (d) => isMatrix(d),
      fields: [
        {
          key: 'groupingsAcross',
          label: t('report.editor.grouping'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <GroupingsBuilder availableFields={availableFields} value={value} onChange={onChange} t={t} testIdPrefix="cols-grouping" />
          ),
        },
      ],
    },
    // Tabular layout: this section is just "Columns" — the visible report columns.
    {
      key: 'tabular-columns',
      title: t('report.editor.columns'),
      collapsible: true,
      hint: t('report.editor.columnsHint'),
      visibleWhen: (d) => d.type !== 'joined' && !isSummary(d) && !isMatrix(d),
      fields: [
        {
          key: 'columns',
          label: t('report.editor.columns'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <ColumnsEditor availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    // Summary / matrix layout: this section holds the aggregated *values* for
    // each cell (pivot Values dropzone). Renamed to disambiguate from the
    // matrix's "Columns" (pivot axis) section above.
    {
      key: 'values',
      title: t('report.editor.values'),
      collapsible: true,
      hint: t('report.editor.valuesHint'),
      visibleWhen: (d) => isSummary(d) || isMatrix(d),
      fields: [
        {
          key: 'columns',
          label: t('report.editor.values'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <ColumnsEditor availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    {
      key: 'filters',
      title: t('report.editor.filters'),
      collapsible: true,
      hint: t('report.editor.filtersHint'),
      visibleWhen: (d) => d.type !== 'joined',
      fields: [
        {
          key: 'filter',
          label: t('report.editor.filters'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <SpecFilterAdapter availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    {
      key: 'blocks',
      title: t('report.editor.blocks'),
      collapsible: true,
      hint: t('report.editor.blocksHint'),
      visibleWhen: (d) => d.type === 'joined',
      fields: [
        {
          key: 'blocks',
          label: t('report.editor.blocks'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => (
            <JoinedBlocksEditor
              value={value}
              onChange={onChange}
              availableFields={availableFields}
              getFieldsForObject={getFieldsForObject}
              containerObjectName={draft?.objectName}
              t={t}
            />
          ),
        },
      ],
    },
    {
      key: 'chart',
      title: t('report.editor.chart'),
      collapsible: true,
      defaultCollapsed: true,
      hint: t('report.editor.chartHint'),
      visibleWhen: (d) => supportsChart(d),
      fields: [
        {
          key: 'chart',
          label: t('report.editor.chart'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => (
            <ChartConfig
              availableFields={availableFields}
              columns={normalizeColumns(draft.columns)}
              value={value}
              onChange={onChange}
              t={t}
            />
          ),
        },
      ],
    },
  ];

  return {
    breadcrumb: [t('report.editor.breadcrumb', 'Configuration')],
    sections,
  };
}

// ---------------------------------------------------------------------------
// ValidationBanner — surfaces missing-required-spec issues at the top
// ---------------------------------------------------------------------------

type ValidationProblem = { level: 'error' | 'warning'; message: string };

function collectValidationProblems(draft: Record<string, any>, t: Translator): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const type = draft.type ?? 'tabular';
  const downCount = Array.isArray(draft.groupingsDown) ? draft.groupingsDown.length : 0;
  const acrossCount = Array.isArray(draft.groupingsAcross) ? draft.groupingsAcross.length : 0;
  const cols = Array.isArray(draft.columns) ? draft.columns.length : 0;

  if (!draft.objectName) {
    problems.push({
      level: cols > 0 ? 'error' : 'warning',
      message: t('report.editor.validationNeedsObject'),
    });
  }
  if (type === 'matrix' && (downCount === 0 || acrossCount === 0)) {
    problems.push({ level: 'error', message: t('report.editor.validationMatrixNeedsRowsCols') });
  }
  if (type === 'summary' && downCount === 0) {
    problems.push({ level: 'error', message: t('report.editor.validationSummaryNeedsRows') });
  }
  if (type === 'joined') {
    for (const message of validateJoinedBlocks(draft.blocks, t)) {
      problems.push({ level: 'error', message });
    }
  }
  return problems;
}

function ValidationBanner({ problems }: { problems: ValidationProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <div className="space-y-1 p-2 border-b" data-testid="report-validation-banner">
      {problems.map((p, i) => (
        <div
          key={i}
          className={
            'flex items-start gap-2 text-[11px] rounded px-2 py-1 ' +
            (p.level === 'error'
              ? 'bg-red-50 border border-red-200 text-red-900'
              : 'bg-amber-50 border border-amber-200 text-amber-900')
          }
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{p.message}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportConfigPanel — public entry consumed by ReportView
// ---------------------------------------------------------------------------

export interface ReportConfigPanelProps {
  open: boolean;
  onClose: () => void;
  config: Record<string, any> | null;
  onSave: (config: Record<string, any>) => void;
  onFieldChange?: (key: string, value: any, draft: Record<string, any>) => void;
  availableFields?: AvailableField[];
  /**
   * Optional resolver that returns the field list for a given object name.
   * Used by `JoinedBlocksEditor` so blocks with an `objectName` override
   * pick their fields from the right object schema instead of the container's.
   * If omitted, blocks fall back to `availableFields`.
   */
  getFieldsForObject?: (objectName: string | undefined) => AvailableField[] | undefined;
}

export function ReportConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
  availableFields,
  getFieldsForObject,
}: ReportConfigPanelProps) {
  const { t } = useTranslation();
  const tt: Translator = React.useCallback(
    (key, defaultValue, options) => {
      if (defaultValue !== undefined) return t(key, { defaultValue, ...(options || {}) }) as string;
      return t(key, options) as string;
    },
    [t],
  );

  const fields: AvailableField[] = availableFields ?? [];
  const schema = React.useMemo(
    () => buildReportSchema(fields, tt, getFieldsForObject),
    [fields, tt, getFieldsForObject],
  );

  const source = React.useMemo(() => config ?? {}, [config]);
  const { draft, isDirty, updateField, discard } = useConfigDraft<Record<string, any>>(source);

  const handleFieldChange = React.useCallback(
    (key: string, value: any) => {
      updateField(key, value);
      onFieldChange?.(key, value, { ...draft, [key]: value });
    },
    [updateField, onFieldChange, draft],
  );

  const handleSave = React.useCallback(() => {
    onSave(draft);
    onClose();
  }, [draft, onSave, onClose]);

  const problems = React.useMemo(() => collectValidationProblems(draft, tt), [draft, tt]);

  if (!open) return null;

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={schema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={handleFieldChange}
      onSave={handleSave}
      onDiscard={discard}
      headerExtra={<ValidationBanner problems={problems} />}
      style={{ ['--config-panel-width' as any]: '440px' } as React.CSSProperties}
    />
  );
}

export default ReportConfigPanel;

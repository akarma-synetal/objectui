/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Button } from '@object-ui/components';
import {
  Plus,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { JoinedReportBlock } from '@object-ui/types';
import {
  type AvailableField,
  ColumnsEditor,
  GroupingsBuilder,
  ChartConfig,
  SpecFilterAdapter,
  normalizeColumns,
} from './ReportConfigPanel';

type Translator = (key: string, fallback?: string) => string;
type BlockType = 'tabular' | 'summary' | 'matrix';
const BLOCK_TYPES: BlockType[] = ['tabular', 'summary', 'matrix'];

function makeNewBlock(existing: JoinedReportBlock[]): JoinedReportBlock {
  let i = existing.length + 1;
  const used = new Set(existing.map((b) => b.name).filter(Boolean));
  let name = `block_${i}`;
  while (used.has(name)) {
    i += 1;
    name = `block_${i}`;
  }
  return { name, type: 'tabular', columns: [] };
}

function readBlockLabel(block: JoinedReportBlock): string {
  if (typeof block.label === 'string') return block.label;
  if (block.label && typeof block.label === 'object') return block.label.default ?? '';
  return '';
}

function readBlockDescription(block: JoinedReportBlock): string {
  if (typeof block.description === 'string') return block.description;
  if (block.description && typeof block.description === 'object') return block.description.default ?? '';
  return '';
}

interface BlockCardProps {
  block: JoinedReportBlock;
  index: number;
  total: number;
  availableFields: AvailableField[];
  t: Translator;
  duplicateName: boolean;
  onChange: (next: JoinedReportBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

function BlockCard({
  block,
  index,
  total,
  availableFields,
  t,
  duplicateName,
  onChange,
  onRemove,
  onMove,
}: BlockCardProps) {
  const [expanded, setExpanded] = React.useState(index === 0);
  const blockType: BlockType = (block.type as BlockType) ?? 'tabular';
  const isSummary = blockType === 'summary';
  const isMatrix = blockType === 'matrix';
  const supportsChart = isSummary || isMatrix;
  const nameEmpty = !block.name || !block.name.trim();
  const nameError = nameEmpty || duplicateName;

  const update = (patch: Partial<JoinedReportBlock>) => onChange({ ...block, ...patch });

  return (
    <div
      className="border rounded-md bg-card text-card-foreground"
      data-testid={`joined-block-${index}`}
    >
      <div className="flex items-center gap-1 p-1.5 border-b bg-muted/30">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse block' : 'Expand block'}
          aria-expanded={expanded}
          data-testid={`joined-block-toggle-${index}`}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
        <input
          type="text"
          className={`h-6 text-xs border rounded px-1.5 bg-background flex-1 min-w-0 ${nameError ? 'border-destructive' : ''}`}
          value={block.name ?? ''}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={t('report.editor.blockNamePlaceholder')}
          aria-label={t('report.editor.blockName')}
          aria-invalid={nameError}
          data-testid={`joined-block-name-${index}`}
        />
        <select
          className="h-6 text-xs border rounded px-1 bg-background shrink-0"
          value={blockType}
          onChange={(e) => update({ type: e.target.value as BlockType })}
          aria-label={t('report.editor.type')}
          data-testid={`joined-block-type-${index}`}
        >
          {BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`report.editor.type${type.charAt(0).toUpperCase()}${type.slice(1)}`)}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move block up"
          >
            <ArrowUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Move block down"
          >
            <ArrowDown className="h-2.5 w-2.5" />
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={t('report.editor.removeBlock')}
          data-testid={`joined-block-remove-${index}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {nameError && (
        <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-destructive bg-destructive/5 border-b">
          <AlertTriangle className="h-3 w-3" />
          {nameEmpty
            ? t('report.editor.validationBlockNameRequired')
            : t('report.editor.validationBlockNameDuplicate')}
        </div>
      )}
      {expanded && (
        <div className="p-2 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">{t('report.editor.blockLabel')}</span>
              <input
                type="text"
                className="h-6 text-xs border rounded px-1.5 bg-background"
                value={readBlockLabel(block)}
                onChange={(e) => update({ label: e.target.value || undefined })}
                placeholder={t('report.editor.blockLabelPlaceholder')}
                data-testid={`joined-block-label-${index}`}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">{t('report.editor.objectName')}</span>
              <input
                type="text"
                className="h-6 text-xs border rounded px-1.5 bg-background"
                value={block.objectName ?? ''}
                onChange={(e) => update({ objectName: e.target.value || undefined })}
                placeholder={t('report.editor.objectNamePlaceholder')}
                data-testid={`joined-block-object-${index}`}
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">{t('report.editor.blockDescription')}</span>
            <textarea
              className="text-xs border rounded px-1.5 py-1 bg-background resize-y min-h-[2rem]"
              rows={2}
              value={readBlockDescription(block)}
              onChange={(e) => update({ description: e.target.value || undefined })}
              placeholder={t('report.editor.blockDescriptionPlaceholder')}
              data-testid={`joined-block-description-${index}`}
            />
          </label>

          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">{t('report.editor.columns')}</div>
            <ColumnsEditor
              availableFields={availableFields}
              value={block.columns}
              onChange={(v) => update({ columns: v })}
              t={t}
            />
          </div>

          {(isSummary || isMatrix) && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('report.editor.rows')}</div>
              <GroupingsBuilder
                availableFields={availableFields}
                value={block.groupingsDown}
                onChange={(v) => update({ groupingsDown: v })}
                t={t}
              />
            </div>
          )}

          {isMatrix && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('report.editor.columnsAxis')}</div>
              <GroupingsBuilder
                availableFields={availableFields}
                value={block.groupingsAcross}
                onChange={(v) => update({ groupingsAcross: v })}
                t={t}
              />
            </div>
          )}

          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">{t('report.editor.filters')}</div>
            <SpecFilterAdapter
              availableFields={availableFields}
              value={block.filter}
              onChange={(v) => update({ filter: v })}
              t={t}
            />
          </div>

          {supportsChart && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('report.editor.chart')}</div>
              <ChartConfig
                availableFields={availableFields}
                columns={normalizeColumns(block.columns)}
                value={block.chart}
                onChange={(v) => update({ chart: v })}
                t={t}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface JoinedBlocksEditorProps {
  value: unknown;
  onChange: (next: JoinedReportBlock[]) => void;
  /** Default field list — used when a block has no `objectName` override. */
  availableFields: AvailableField[];
  /**
   * Optional resolver returning the field list for a given object name.
   * Used to source the correct fields when a block overrides `objectName`.
   * If omitted or returns `undefined`, the block uses `availableFields`.
   */
  getFieldsForObject?: (objectName: string | undefined) => AvailableField[] | undefined;
  /**
   * The container report's `objectName`. When a block omits its own
   * `objectName`, the editor resolves fields against this name (when a
   * resolver is provided) so the field list matches the runtime behaviour
   * of `JoinedReportRenderer` (which inherits the container's object).
   */
  containerObjectName?: string;
  t: Translator;
}

function normalizeBlocks(value: unknown): JoinedReportBlock[] {
  if (!Array.isArray(value)) return [];
  return value.map((b) => {
    const block = (b ?? {}) as Partial<JoinedReportBlock>;
    return {
      name: block.name ?? '',
      type: (block.type as BlockType) ?? 'tabular',
      columns: Array.isArray(block.columns) ? block.columns : [],
      ...block,
    } as JoinedReportBlock;
  });
}

export function JoinedBlocksEditor({
  value,
  onChange,
  availableFields,
  getFieldsForObject,
  containerObjectName,
  t,
}: JoinedBlocksEditorProps) {
  const blocks = normalizeBlocks(value);

  const resolveFields = (block: JoinedReportBlock): AvailableField[] => {
    if (!getFieldsForObject) return availableFields;
    const target = block.objectName ?? containerObjectName;
    return getFieldsForObject(target) ?? availableFields;
  };

  const counts: Record<string, number> = {};
  for (const b of blocks) {
    if (!b.name) continue;
    counts[b.name] = (counts[b.name] ?? 0) + 1;
  }

  const updateBlock = (idx: number, next: JoinedReportBlock) => {
    onChange(blocks.map((b, i) => (i === idx ? next : b)));
  };

  const removeBlock = (idx: number) => {
    onChange(blocks.filter((_, i) => i !== idx));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addBlock = () => {
    onChange([...blocks, makeNewBlock(blocks)]);
  };

  return (
    <div className="space-y-2" data-testid="joined-blocks-editor">
      {blocks.length === 0 && (
        <div className="text-[10px] text-muted-foreground italic px-1">
          {t('report.editor.validationJoinedNeedsBlocks')}
        </div>
      )}
      {blocks.map((block, idx) => (
        <BlockCard
          key={idx}
          block={block}
          index={idx}
          total={blocks.length}
          availableFields={resolveFields(block)}
          t={t}
          duplicateName={Boolean(block.name) && (counts[block.name] ?? 0) > 1}
          onChange={(next) => updateBlock(idx, next)}
          onRemove={() => removeBlock(idx)}
          onMove={(dir) => moveBlock(idx, dir)}
        />
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs w-full"
        onClick={addBlock}
        data-testid="joined-block-add"
      >
        <Plus className="h-3 w-3 mr-1" />
        {t('report.editor.addBlock')}
      </Button>
    </div>
  );
}

/**
 * Static validation for the `blocks` array of a joined report.
 * Returns an array of i18n keys (already-translated strings) describing problems,
 * suitable for direct rendering in the validation banner.
 */
export function validateJoinedBlocks(blocks: unknown, t: Translator): string[] {
  const issues: string[] = [];
  if (!Array.isArray(blocks) || blocks.length === 0) {
    issues.push(t('report.editor.validationJoinedNeedsBlocks'));
    return issues;
  }
  const seen = new Map<string, number>();
  let needsName = false;
  let dupName = false;
  let emptyCols = false;
  for (const raw of blocks) {
    const b = (raw ?? {}) as Partial<JoinedReportBlock>;
    if (!b.name || !String(b.name).trim()) {
      needsName = true;
    } else {
      const c = (seen.get(b.name) ?? 0) + 1;
      seen.set(b.name, c);
      if (c === 2) dupName = true;
    }
    if (!Array.isArray(b.columns) || b.columns.length === 0) {
      emptyCols = true;
    }
  }
  if (needsName) issues.push(t('report.editor.validationBlockNameRequired'));
  if (dupName) issues.push(t('report.editor.validationBlockNameDuplicate'));
  if (emptyCols) issues.push(t('report.editor.validationBlockNeedsColumns'));
  return issues;
}

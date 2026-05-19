/**
 * JoinedReportRenderer
 *
 * Renders a spec `Report` of `type: 'joined'` as a vertical stack of
 * self-contained `ReportRenderer` blocks. Each block is its own `SpecReport`
 * with its own data fetch, aggregations, and drill — they are independent
 * widgets composed on a single page.
 *
 * Filter inheritance
 * ------------------
 * The outer (joined) report can carry a top-level `filter`. It is merged into
 * each block's `filter` as a logical `$and`, so a report-wide constraint
 * (e.g. "owner = me") propagates to every block without repetition. Block
 * filters keep precedence on key collisions because they are by convention
 * the more specific constraint.
 *
 * Drill & runtime propagation
 * ---------------------------
 * `dataSource`, `actionRunner`, `drillView`, `drillOpenIn` and `runtimeFilter`
 * flow uniformly into every block so any block's drill behaves identically to
 * a standalone report. Each block calls its own {@link useReportData} hook —
 * there is no shared cache, by design (blocks may query different objects).
 *
 * Layout
 * ------
 * Blocks render vertically. The block label/description renders above the
 * block content. We intentionally avoid imposing a column layout: composition
 * (e.g. a 2×2 grid of blocks) is a host concern handled by a parent layout
 * component.
 */

import * as React from 'react';
import type { ActionRunner } from '@object-ui/core';
import {
  isJoinedSpecReport,
  type DataSource,
  type JoinedReportBlock,
  type JoinedSpecReport,
  type SpecReport,
} from '@object-ui/types';
import { ReportRenderer } from './ReportRenderer';
import { mergeFilters } from './hooks/useReportData';
import type { DrillOpenIn, DrillView } from './drill';

export interface JoinedReportRendererProps {
  report: JoinedSpecReport;
  dataSource?: DataSource;
  /** Runtime filter (e.g. global toolbar filter) merged into every block. */
  runtimeFilter?: Record<string, unknown>;
  actionRunner?: ActionRunner;
  drillView?: DrillView;
  drillOpenIn?: DrillOpenIn;
  className?: string;
  /** Override rendering of an individual block (advanced). */
  renderBlock?: (block: JoinedReportBlock, index: number, content: React.ReactNode) => React.ReactNode;
}

function resolveLabel(
  label: JoinedReportBlock['label'] | undefined,
  fallback: string,
): string {
  if (!label) return fallback;
  if (typeof label === 'string') return label;
  if (typeof label === 'object' && typeof label.default === 'string') return label.default;
  return fallback;
}

/**
 * Merge the joined-report-level filter into a block's own filter so the
 * inherited constraint applies to every block. Block filter wins on key
 * collisions (it's the more specific constraint by convention).
 */
function applyInheritedFilter(
  block: SpecReport,
  outerFilter: Record<string, unknown> | undefined,
): SpecReport {
  if (!outerFilter || Object.keys(outerFilter).length === 0) return block;
  const merged = mergeFilters(outerFilter, block.filter as Record<string, unknown> | undefined);
  return { ...block, filter: merged } as SpecReport;
}

export const JoinedReportRenderer: React.FC<JoinedReportRendererProps> = ({
  report,
  dataSource,
  runtimeFilter,
  actionRunner,
  drillView,
  drillOpenIn,
  className,
  renderBlock,
}) => {
  if (!isJoinedSpecReport(report)) {
    return (
      <div
        className={className}
        data-testid="joined-report-invalid"
        style={{ color: 'var(--color-destructive, #b91c1c)', fontSize: 13, padding: 12 }}
      >
        JoinedReportRenderer requires a report with <code>type: 'joined'</code> and a <code>blocks</code> array.
      </div>
    );
  }

  const blocks = report.blocks ?? [];
  const outerFilter = report.filter as Record<string, unknown> | undefined;
  const containerObjectName = (report as any).objectName as string | undefined;

  return (
    <div
      className={className}
      data-testid="joined-report"
      data-report-name={report.name}
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {blocks.map((block, index) => {
        // Promote the flat block to a self-contained SpecReport. The block's
        // `objectName` falls back to the joined container's `objectName`, and
        // its type defaults to `tabular`. The block-level filter is then ANDed
        // with the outer (container) filter so a top-level scope inherits.
        const blockObjectName = block.objectName ?? containerObjectName ?? '';
        const blockReport = {
          ...block,
          objectName: blockObjectName,
          type: (block.type ?? 'tabular') as SpecReport['type'],
          columns: block.columns ?? [],
        } as SpecReport;
        const scopedBlockReport = applyInheritedFilter(blockReport, outerFilter);
        const blockLabel = resolveLabel(block.label, block.name);
        const blockDescription = block.description
          ? resolveLabel(block.description, '')
          : '';
        const key = block.name ?? `block-${index}`;

        const content = (
          <ReportRenderer
            schema={scopedBlockReport}
            dataSource={dataSource}
            runtimeFilter={runtimeFilter}
            actionRunner={actionRunner}
            drillView={drillView}
            drillOpenIn={drillOpenIn}
          />
        );

        const defaultBlock = (
          <section
            key={key}
            data-testid="joined-report-block"
            data-block-id={key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              border: '1px solid var(--color-border, #e4e4e7)',
              borderRadius: 8,
              padding: 16,
              background: 'var(--color-card, #ffffff)',
            }}
          >
            <header style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{blockLabel}</h3>
              {blockDescription ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted-foreground, #71717a)' }}>
                  {blockDescription}
                </p>
              ) : null}
            </header>
            {content}
          </section>
        );

        return renderBlock ? renderBlock(block, index, defaultBlock) : defaultBlock;
      })}
    </div>
  );
};

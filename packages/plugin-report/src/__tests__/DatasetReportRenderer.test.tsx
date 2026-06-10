/**
 * DatasetReportRenderer tests (ADR-0021 single-form).
 *
 * Covers:
 *  - isDatasetReport guard (dataset-bound report / joined-with-dataset-blocks)
 *  - summary report → grouped table via dataSource.queryDataset
 *  - joined report → one dataset-bound table per block
 *  - report-level runtimeFilter merged into the dataset query
 *  - missing queryDataset → a clear error instead of a blank
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatasetReportRenderer, isDatasetReport } from '../DatasetReportRenderer';

function makeSource(rowsByDataset: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ dataset: string; selection: any }> = [];
  return {
    calls,
    queryDataset: vi.fn(async (dataset: string, selection: unknown) => {
      calls.push({ dataset, selection: selection as any });
      return { rows: rowsByDataset[dataset] ?? [] };
    }),
  };
}

describe('isDatasetReport', () => {
  it('matches a report bound to a dataset', () => {
    expect(isDatasetReport({ name: 'r', dataset: 'task_metrics', values: ['c'] })).toBe(true);
  });
  it('matches a joined report whose blocks are dataset-bound', () => {
    expect(isDatasetReport({ type: 'joined', blocks: [{ dataset: 'task_metrics', values: ['c'] }] })).toBe(true);
  });
  it('does not match a legacy object-bound report', () => {
    expect(isDatasetReport({ name: 'r', objectName: 'task', columns: [{ field: 'x' }] })).toBe(false);
    expect(isDatasetReport(null)).toBe(false);
  });
});

describe('DatasetReportRenderer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a summary report as a grouped table', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }, { status: 'Done', est_hours: 24 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'hours', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    // headers are the row + value names
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('est_hours')).toBeInTheDocument();
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({
      dimensions: ['status'], measures: ['est_hours'],
    }));
  });

  it('renders a joined report as one table per block', async () => {
    const src = makeSource({ task_metrics: [{ status: 'To Do', task_count: 4 }] });
    render(
      <DatasetReportRenderer
        report={{
          name: 'overview', type: 'joined',
          blocks: [
            { name: 'open_block', label: 'Open Tasks', dataset: 'task_metrics', rows: ['status'], values: ['task_count'], runtimeFilter: { done: false } },
            { name: 'done_block', label: 'Completed Tasks', dataset: 'task_metrics', rows: ['status'], values: ['task_count'], runtimeFilter: { done: true } },
          ],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Open Tasks')).toBeInTheDocument());
    expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
    expect(screen.getAllByTestId('dataset-report-block')).toHaveLength(2);
    // each block forwards its own runtimeFilter
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({ runtimeFilter: { done: false } }));
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({ runtimeFilter: { done: true } }));
  });

  it('merges the report-level runtimeFilter into the dataset query', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', task_count: 1 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] }}
        dataSource={src}
        runtimeFilter={{ owner: 'me' }}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    expect(src.calls[0].selection.runtimeFilter).toMatchObject({ owner: 'me' });
  });

  it('shows an error when the data source cannot run dataset queries', async () => {
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] }}
        dataSource={{}}
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/does not support dataset queries/i)).toBeInTheDocument();
  });
});

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Smoke tests for SpecReportGrid: spec Report → ObjectGrid bridge.
 *
 * Note: we only assert on the wrapper output (totals strip, banner) and on the
 * callback wiring. The grid internals are exercised by plugin-grid's own suite.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpecReport } from '@object-ui/types';
import { ActionRunner } from '@object-ui/core';
import { SpecReportGrid } from '../SpecReportGrid';
import { registerDrillHandler } from '../drill';

const dataset = [
  { id: 1, region: 'East', amount: 100, owner: 'alice' },
  { id: 2, region: 'East', amount: 200, owner: 'alice' },
  { id: 3, region: 'West', amount: 300, owner: 'bob' },
];

describe('SpecReportGrid', () => {
  it('renders a summary report with totals strip', async () => {
    const report = SpecReport.create({
      name: 'sales_by_region',
      label: 'Sales by Region',
      objectName: 'opportunity',
      type: 'summary',
      groupingsDown: [{ field: 'region' }],
      columns: [
        { field: 'region' },
        { field: 'amount', aggregate: 'sum' },
        { field: 'owner', aggregate: 'unique' },
      ],
    });

    render(<SpecReportGrid report={report} rows={dataset} />);
    const totals = await screen.findByTestId('spec-report-kpis');
    expect(totals).toBeInTheDocument();
    // Totals: sum(amount)=600, unique(owner)=2
    expect(totals.textContent).toContain('600');
    expect(totals.textContent).toContain('2');
  });

  it('shows a placeholder banner for matrix reports (deferred to M2)', () => {
    const report = SpecReport.create({
      name: 'matrix_demo',
      label: 'Matrix Demo',
      objectName: 'opportunity',
      type: 'matrix',
      groupingsDown: [{ field: 'region' }],
      groupingsAcross: [{ field: 'quarter' }],
      columns: [{ field: 'amount', aggregate: 'sum' }],
    });
    render(<SpecReportGrid report={report} rows={dataset} />);
    expect(screen.getByText(/not yet supported/i)).toBeInTheDocument();
  });

  it('passes drill-down keys to the callback when a row is clicked', async () => {
    const report = SpecReport.create({
      name: 'tabular_demo',
      label: 'Tabular Demo',
      objectName: 'opportunity',
      type: 'tabular',
      columns: [{ field: 'region' }, { field: 'amount' }],
    });
    const onDrillDown = vi.fn();
    render(<SpecReportGrid report={report} rows={dataset} onDrillDown={onDrillDown} />);
    // The grid renders a table; clicking the first body row should invoke onDrillDown
    await waitFor(() => {
      const cells = screen.queryAllByText('East');
      expect(cells.length).toBeGreaterThan(0);
    });
    // Find the first East cell and click its parent row
    const firstEast = screen.getAllByText('East')[0];
    const row = firstEast.closest('tr');
    if (row) {
      row.click();
      // Tabular has no groupings, so groupKey is {}
      expect(onDrillDown).toHaveBeenCalled();
    }
  });

  it('dispatches a drill action via the ActionRunner when configured', async () => {
    const report = SpecReport.create({
      name: 'sales_by_region',
      label: 'Sales by Region',
      objectName: 'opportunity',
      type: 'summary',
      groupingsDown: [{ field: 'region' }],
      columns: [{ field: 'amount', aggregate: 'sum' }],
    });
    const runner = new ActionRunner({});
    const navigate = vi.fn();
    registerDrillHandler(runner, { navigate });

    render(<SpecReportGrid report={report} rows={dataset} actionRunner={runner} />);

    await waitFor(() => {
      const cells = screen.queryAllByText('East');
      expect(cells.length).toBeGreaterThan(0);
    });
    const firstEast = screen.getAllByText('East')[0];
    const row = firstEast.closest('tr');
    if (row) {
      row.click();
      await waitFor(() => expect(navigate).toHaveBeenCalled());
      expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
        objectName: 'opportunity',
        view: 'list',
        openIn: 'current',
        filter: expect.objectContaining({ region: 'East' }),
      }));
    }
  });
});

/**
 * MatrixRenderer tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionRunner } from '@object-ui/core';
import type { SpecReport } from '@object-ui/types';
import { MatrixRenderer } from '../MatrixRenderer';
import { registerDrillHandler } from '../drill';

const rows = [
  { region: 'East', quarter: '2024-Q1', amount: 100 },
  { region: 'East', quarter: '2024-Q1', amount: 200 },
  { region: 'East', quarter: '2024-Q2', amount: 150 },
  { region: 'West', quarter: '2024-Q1', amount: 300 },
  { region: 'West', quarter: '2024-Q2', amount: 50 },
];

const matrix: SpecReport = {
  name: 'region_quarter',
  objectName: 'opportunity',
  type: 'matrix',
  groupingsDown: [{ field: 'region' }],
  groupingsAcross: [{ field: 'quarter' }],
  columns: [{ field: 'amount', aggregate: 'sum', label: 'Pipeline $' }],
};

describe('MatrixRenderer', () => {
  it('renders row × column headers + cells + totals', () => {
    render(<MatrixRenderer report={matrix} rows={rows} />);
    expect(screen.getByTestId('matrix-renderer')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
    expect(screen.getByText('West')).toBeInTheDocument();
    expect(screen.getByText('2024-Q1')).toBeInTheDocument();
    expect(screen.getByText('2024-Q2')).toBeInTheDocument();
    // East × Q1 = 100 + 200 = 300; West × Q1 = 300 (so '300' appears twice in cells)
    expect(screen.getAllByText('300')).toHaveLength(2);
    // Row total East = 450 (300+150); West = 350 (300+50); grand = 800
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
  });

  it('renders an empty-state hint when groupingsAcross is missing', () => {
    const noAcross: SpecReport = { ...matrix, groupingsAcross: undefined as never };
    render(<MatrixRenderer report={noAcross} rows={rows} />);
    expect(screen.getByTestId('matrix-empty')).toHaveTextContent(/groupingsAcross/);
  });

  it('fires onCellClick with row + column keys', () => {
    const onCellClick = vi.fn();
    render(<MatrixRenderer report={matrix} rows={rows} onCellClick={onCellClick} />);
    // Find a body cell with data-row/data-col attributes
    const cell = document.querySelector('td[data-row][data-col]') as HTMLElement;
    expect(cell).not.toBeNull();
    fireEvent.click(cell);
    expect(onCellClick).toHaveBeenCalledTimes(1);
    const args = onCellClick.mock.calls[0][0];
    expect(args.rowKey).toHaveProperty('region');
    expect(args.colKey).toHaveProperty('quarter');
    expect(args.combinedKey).toEqual({ ...args.rowKey, ...args.colKey });
  });

  it('dispatches a drill action through actionRunner', () => {
    const navigate = vi.fn();
    const runner = new ActionRunner();
    registerDrillHandler(runner, { navigate });
    render(<MatrixRenderer report={matrix} rows={rows} actionRunner={runner} />);
    const cell = document.querySelector('td[data-row][data-col]') as HTMLElement;
    fireEvent.click(cell);
    expect(navigate).toHaveBeenCalledTimes(1);
    const target = navigate.mock.calls[0][0];
    expect(target.objectName).toBe('opportunity');
    // Filter chain should include both region and quarter constraints (via $and merge).
    expect(JSON.stringify(target.filter)).toContain('region');
    expect(JSON.stringify(target.filter)).toContain('quarter');
  });

  it('does not call onCellClick for empty cells', () => {
    const sparse = rows.filter((r) => !(r.region === 'West' && r.quarter === '2024-Q2'));
    const onCellClick = vi.fn();
    const { container } = render(
      <MatrixRenderer report={matrix} rows={sparse} onCellClick={onCellClick} />,
    );
    // The West / 2024-Q2 cell shows the em-dash and has no handler.
    const allCells = container.querySelectorAll('td[data-row][data-col]');
    // 2 regions × 2 cols = 4 cells, one of which should be the em-dash
    expect(allCells.length).toBe(4);
    const emDashCell = Array.from(allCells).find((c) => c.textContent === '\u2014') as HTMLElement;
    expect(emDashCell).toBeDefined();
    fireEvent.click(emDashCell);
    expect(onCellClick).not.toHaveBeenCalled();
  });
});

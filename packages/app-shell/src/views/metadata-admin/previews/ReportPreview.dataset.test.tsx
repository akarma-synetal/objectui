// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ReportPreview } from './ReportPreview';

// Mock the data adapter the preview pulls from AdapterProvider.
const { queryDataset } = vi.hoisted(() => ({ queryDataset: vi.fn() }));
vi.mock('../../../providers/AdapterProvider', () => ({
  useAdapter: () => ({ queryDataset }),
}));

afterEach(() => {
  cleanup();
  queryDataset.mockReset();
});

const baseProps = { type: 'report', name: 'revenue_by_region', locale: 'en-US' as const };

const datasetReport = {
  name: 'revenue_by_region',
  label: 'Revenue by Region',
  dataset: 'sales',
  rows: ['region'],
  values: ['revenue'],
};

describe('ReportPreview — dataset-bound report (ADR-0021 single-form)', () => {
  it('runs the bound dataset (rows→dimensions, values→measures) and renders a table', async () => {
    queryDataset.mockResolvedValue({ rows: [{ region: 'finance', revenue: 450000 }, { region: 'tech', revenue: 260000 }], fields: [] });
    render(<ReportPreview {...baseProps} draft={datasetReport} />);

    await waitFor(() =>
      expect(queryDataset).toHaveBeenCalledWith('sales', { dimensions: ['region'], measures: ['revenue'] }),
    );
    expect(await screen.findByText('finance')).toBeInTheDocument();
    expect(screen.getByText('450000')).toBeInTheDocument();
    expect(screen.getByText('tech')).toBeInTheDocument();
  });

  it('shows an empty state when no measures are selected', async () => {
    render(<ReportPreview {...baseProps} draft={{ ...datasetReport, values: [] }} />);
    expect(await screen.findByText(/choose at least one measure/i)).toBeInTheDocument();
    expect(queryDataset).not.toHaveBeenCalled();
  });

  it('surfaces a dataset compile/RLS error instead of wrong numbers', async () => {
    queryDataset.mockRejectedValue(new Error('relationship "account" is not declared in the dataset'));
    render(<ReportPreview {...baseProps} draft={datasetReport} />);
    expect(await screen.findByText(/not declared in the dataset/)).toBeInTheDocument();
  });

  it('renders a matrix draft as the same cross-tab the runtime shows', async () => {
    queryDataset.mockResolvedValue({
      rows: [
        { region: 'east', stage: 'won', revenue: 100 },
        { region: 'east', stage: 'lost', revenue: 40 },
        { region: 'west', stage: 'won', revenue: 70 },
      ],
      fields: [],
    });
    render(
      <ReportPreview
        {...baseProps}
        draft={{ ...datasetReport, type: 'matrix', rows: ['region'], columns: ['stage'] }}
      />,
    );
    expect(await screen.findByTestId('dataset-matrix')).toBeInTheDocument();
    expect(queryDataset).toHaveBeenCalledWith('sales', expect.objectContaining({ dimensions: ['region', 'stage'] }));
  });

  it('forwards runtimeFilter to the dataset query', async () => {
    queryDataset.mockResolvedValue({ rows: [], fields: [] });
    render(<ReportPreview {...baseProps} draft={{ ...datasetReport, runtimeFilter: { stage: 'won' } }} />);
    await waitFor(() =>
      expect(queryDataset).toHaveBeenCalledWith('sales', { dimensions: ['region'], measures: ['revenue'], runtimeFilter: { stage: 'won' } }),
    );
  });
});

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

describe('ReportPreview — dataset-bound report (ADR-0021 dual-form)', () => {
  it('runs the bound dataset (rows→dimensions, values→measures) and renders a table', async () => {
    queryDataset.mockResolvedValue({ rows: [{ region: 'finance', revenue: 450000 }, { region: 'tech', revenue: 260000 }], fields: [] });
    render(<ReportPreview {...baseProps} draft={datasetReport} />);

    await waitFor(() =>
      expect(queryDataset).toHaveBeenCalledWith('sales', { dimensions: ['region'], measures: ['revenue'], runtimeFilter: undefined }),
    );
    expect(await screen.findByText('finance')).toBeInTheDocument();
    expect(screen.getByText('450000')).toBeInTheDocument();
    expect(screen.getByText('tech')).toBeInTheDocument();
  });

  it('shows an empty state when no measures are selected', () => {
    render(<ReportPreview {...baseProps} draft={{ ...datasetReport, values: [] }} />);
    expect(screen.getByText(/Pick measures to show/)).toBeInTheDocument();
    expect(queryDataset).not.toHaveBeenCalled();
  });

  it('surfaces a dataset compile/RLS error instead of wrong numbers', async () => {
    queryDataset.mockRejectedValue(new Error('relationship "account" is not declared in the dataset'));
    render(<ReportPreview {...baseProps} draft={datasetReport} />);
    expect(await screen.findByText(/not declared in the dataset/)).toBeInTheDocument();
  });

  it('forwards runtimeFilter to the dataset query', async () => {
    queryDataset.mockResolvedValue({ rows: [], fields: [] });
    render(<ReportPreview {...baseProps} draft={{ ...datasetReport, runtimeFilter: { stage: 'won' } }} />);
    await waitFor(() =>
      expect(queryDataset).toHaveBeenCalledWith('sales', { dimensions: ['region'], measures: ['revenue'], runtimeFilter: { stage: 'won' } }),
    );
  });
});

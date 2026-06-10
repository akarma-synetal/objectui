// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { DatasetWidget } from '../DatasetWidget';

afterEach(cleanup);

const makeSource = (impl: (d: string, s: any) => Promise<{ rows: any[] }>) => ({ queryDataset: vi.fn(impl) });

describe('DatasetWidget', () => {
  it('renders a KPI value for a metric widget', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 510000 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={src} />);
    expect(await screen.findByText('510000')).toBeInTheDocument();
    expect(src.queryDataset).toHaveBeenCalledWith('sales', { dimensions: [], measures: ['revenue'] });
  });

  it('runs the dataset query for a dimensioned (chart) widget — rows→dimensions, values→measures', async () => {
    const src = makeSource(async () => ({ rows: [{ stage: 'won', revenue: 100 }, { stage: 'lost', revenue: 20 }] }));
    render(<DatasetWidget widget={{ type: 'bar', dataset: 'sales', dimensions: ['stage'], values: ['revenue'] }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalledWith('sales', { dimensions: ['stage'], measures: ['revenue'] }));
  });

  it('forwards compareTo when set', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 1 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], compareTo: 'previousPeriod' }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalledWith('sales', { dimensions: [], measures: ['revenue'], compareTo: 'previousPeriod' }));
  });

  it('forwards the widget filter as runtimeFilter — a dataset-bound widget stays filtered (ADR-0021)', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 8179769 }] }));
    const filter = { stage: { $nin: ['closed_won', 'closed_lost'] } };
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], filter }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalledWith('sales', {
      dimensions: [], measures: ['revenue'], runtimeFilter: filter,
    }));
  });

  it('resolves date macros in the widget filter before sending runtimeFilter', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 1 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], filter: { close_date: { $gte: '{current_quarter_start}' } } }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    const selection = src.queryDataset.mock.calls[0][1] as any;
    // Macro is resolved to a concrete value, not passed through verbatim.
    expect(selection.runtimeFilter.close_date.$gte).not.toBe('{current_quarter_start}');
  });

  it('surfaces a dataset error instead of wrong numbers', async () => {
    const src = makeSource(async () => { throw new Error('relationship "account" not declared'); });
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={src} />);
    expect(await screen.findByText(/not declared/)).toBeInTheDocument();
  });

  it('errors when the data source cannot run dataset queries', async () => {
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={{}} />);
    await waitFor(() => expect(screen.getByText(/does not support dataset queries/)).toBeInTheDocument());
  });

  it('prompts when no measures are selected (no query run)', () => {
    const src = makeSource(async () => ({ rows: [] }));
    render(<DatasetWidget widget={{ type: 'bar', dataset: 'sales', dimensions: ['stage'], values: [] }} dataSource={src} />);
    expect(screen.getByText(/Pick measures/)).toBeInTheDocument();
    expect(src.queryDataset).not.toHaveBeenCalled();
  });
});

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DatasetDefaultInspector } from './DatasetDefaultInspector';

afterEach(cleanup);

const baseProps = { type: 'dataset', name: 'sales', locale: 'en-US' as const };

const draft = {
  name: 'sales',
  label: 'Sales',
  object: 'opportunity',
  include: ['account'],
  dimensions: [{ name: 'region', field: 'account.region', type: 'string' }],
  measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount', certified: true }],
};

describe('DatasetDefaultInspector', () => {
  it('renders the structured designer (object / dimension / measure rows)', () => {
    render(<DatasetDefaultInspector {...baseProps} draft={draft} onPatch={vi.fn()} readOnly={false} />);
    expect(screen.getByDisplayValue('opportunity')).toBeInTheDocument();
    expect(screen.getByDisplayValue('account')).toBeInTheDocument(); // include relationship row
    expect(screen.getByText('Dimension 1')).toBeInTheDocument();
    expect(screen.getByText('Measure 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('region')).toBeInTheDocument();
    expect(screen.getByDisplayValue('revenue')).toBeInTheDocument();
  });

  it('adds a measure via onPatch', () => {
    const onPatch = vi.fn();
    render(<DatasetDefaultInspector {...baseProps} draft={draft} onPatch={onPatch} readOnly={false} />);
    fireEvent.click(screen.getByText('Add measure'));
    expect(onPatch).toHaveBeenCalledTimes(1);
    const patch = onPatch.mock.calls[0][0];
    expect(patch.measures).toHaveLength(2);
    expect(patch.measures[1]).toMatchObject({ aggregate: 'sum', certified: false });
  });

  it('adds a dimension via onPatch', () => {
    const onPatch = vi.fn();
    render(<DatasetDefaultInspector {...baseProps} draft={draft} onPatch={onPatch} readOnly={false} />);
    fireEvent.click(screen.getByText('Add dimension'));
    expect(onPatch.mock.calls[0][0].dimensions).toHaveLength(2);
  });

  it('edits a measure name through onPatch', () => {
    const onPatch = vi.fn();
    render(<DatasetDefaultInspector {...baseProps} draft={draft} onPatch={onPatch} readOnly={false} />);
    fireEvent.change(screen.getByDisplayValue('revenue'), { target: { value: 'total_revenue' } });
    expect(onPatch).toHaveBeenCalledWith({ measures: [expect.objectContaining({ name: 'total_revenue' })] });
  });

  it('removes the measure row', () => {
    const onPatch = vi.fn();
    render(<DatasetDefaultInspector {...baseProps} draft={draft} onPatch={onPatch} readOnly={false} />);
    // The measure block's remove button is the second "Remove" (dimension is first).
    const removes = screen.getAllByText('Remove');
    fireEvent.click(removes[removes.length - 1]);
    expect(onPatch).toHaveBeenCalledWith({ measures: [] });
  });

  it('hides add/remove affordances when readOnly', () => {
    render(<DatasetDefaultInspector {...baseProps} draft={draft} onPatch={vi.fn()} readOnly={true} />);
    expect(screen.queryByText('Add measure')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });
});

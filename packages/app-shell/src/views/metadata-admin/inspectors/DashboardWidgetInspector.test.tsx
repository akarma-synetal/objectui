// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardWidgetInspector — dataset binding (ADR-0021). The hand-built widget
 * inspector lets you bind a governed dataset + pick dimensions/values BY NAME,
 * symmetric to the report's dataset binding, so per-widget dataset binding is
 * editable in the form (not only via the raw source tab / API).
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DashboardWidgetInspector } from './DashboardWidgetInspector';

afterEach(cleanup);

/**
 * Stateful host that actually applies `onPatch` back into the draft — needed
 * to exercise controlled-input transitions across multiple edits (a bare spy
 * leaves the input value frozen, so a second edit to the same value is a no-op).
 */
function StatefulInspector({
  initialWidgets,
  onPatchSpy,
  ...rest
}: {
  initialWidgets: Record<string, unknown>[];
  onPatchSpy?: (patch: Record<string, unknown>) => void;
  [k: string]: unknown;
}) {
  const [draft, setDraft] = React.useState<Record<string, unknown>>({ widgets: initialWidgets });
  return (
    <DashboardWidgetInspector
      type="dashboard"
      name="sales"
      locale={'en-US'}
      onClearSelection={vi.fn()}
      onSelectionChange={vi.fn()}
      readOnly={false}
      selection={{ kind: 'widget', id: 'w1' }}
      {...rest}
      draft={draft}
      onPatch={(patch: Record<string, unknown>) => {
        onPatchSpy?.(patch);
        setDraft((d) => ({ ...d, ...patch }));
      }}
    />
  );
}

const baseProps = {
  type: 'dashboard',
  name: 'sales',
  locale: 'en-US' as const,
  onClearSelection: vi.fn(),
  onSelectionChange: vi.fn(),
  readOnly: false,
};

function labelledInput(label: string): HTMLInputElement {
  const lab = screen.getByText(label);
  const input = lab.parentElement!.querySelector('input, textarea');
  return input as HTMLInputElement;
}

const widget = (extra: Record<string, unknown> = {}) => ({
  id: 'w1',
  type: 'bar',
  title: 'Revenue',
  ...extra,
});

describe('DashboardWidgetInspector — dataset binding', () => {
  it('shows the Dataset field; dimensions/values appear only once a dataset is bound', () => {
    const { rerender } = render(
      <DashboardWidgetInspector
        {...baseProps}
        draft={{ widgets: [widget()] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={vi.fn()}
      />,
    );
    // Dataset input is always present…
    expect(labelledInput('Dataset')).toBeInTheDocument();
    // …but dimensions/values are gated behind a bound dataset.
    expect(screen.queryByText('Dimensions')).not.toBeInTheDocument();
    expect(screen.queryByText('Values (measures)')).not.toBeInTheDocument();

    rerender(
      <DashboardWidgetInspector
        {...baseProps}
        draft={{ widgets: [widget({ dataset: 'sales_pipeline', dimensions: ['stage'], values: ['revenue'] })] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={vi.fn()}
      />,
    );
    expect(labelledInput('Dataset').value).toBe('sales_pipeline');
    expect(labelledInput('Dimensions').value).toBe('stage');
    expect(labelledInput('Values (measures)').value).toBe('revenue');
  });

  it('commits the dataset name via onPatch (and clears with empty → undefined)', () => {
    const onPatchSpy = vi.fn();
    render(<StatefulInspector initialWidgets={[widget()]} onPatchSpy={onPatchSpy} />);

    fireEvent.change(labelledInput('Dataset'), { target: { value: 'sales_pipeline' } });
    expect(onPatchSpy).toHaveBeenLastCalledWith({
      widgets: [expect.objectContaining({ id: 'w1', dataset: 'sales_pipeline' })],
    });

    // The bound value is now reflected (stateful host applied the patch).
    expect(labelledInput('Dataset').value).toBe('sales_pipeline');

    onPatchSpy.mockClear();
    fireEvent.change(labelledInput('Dataset'), { target: { value: '' } });
    expect(onPatchSpy).toHaveBeenLastCalledWith({
      widgets: [expect.objectContaining({ id: 'w1', dataset: undefined })],
    });
  });

  it('parses comma-separated dimensions/values into string arrays', () => {
    const onPatch = vi.fn();
    render(
      <DashboardWidgetInspector
        {...baseProps}
        draft={{ widgets: [widget({ dataset: 'sales_pipeline' })] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={onPatch}
      />,
    );
    fireEvent.change(labelledInput('Dimensions'), { target: { value: 'stage, region ,' } });
    expect(onPatch).toHaveBeenCalledWith({
      widgets: [expect.objectContaining({ dimensions: ['stage', 'region'] })],
    });

    onPatch.mockClear();
    fireEvent.change(labelledInput('Values (measures)'), { target: { value: 'revenue,deal_count' } });
    expect(onPatch).toHaveBeenCalledWith({
      widgets: [expect.objectContaining({ values: ['revenue', 'deal_count'] })],
    });
  });

  it('keeps the inline object query editable alongside dataset binding (additive dual-form)', () => {
    render(
      <DashboardWidgetInspector
        {...baseProps}
        draft={{ widgets: [widget({ object: 'crm_opportunity', valueField: 'amount' })] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={vi.fn()}
      />,
    );
    // Both the dataset binding and the legacy inline object field are present.
    expect(labelledInput('Dataset')).toBeInTheDocument();
    expect(labelledInput('Data Source (Object)').value).toBe('crm_opportunity');
    expect(labelledInput('Value Field').value).toBe('amount');
  });

  it('renders Chinese labels under zh-CN', () => {
    render(
      <DashboardWidgetInspector
        {...baseProps}
        locale={'zh-CN'}
        draft={{ widgets: [widget({ dataset: 'sales_pipeline' })] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={vi.fn()}
      />,
    );
    expect(screen.getByText('数据集绑定')).toBeInTheDocument();
    expect(screen.getByText('维度')).toBeInTheDocument();
  });

  it('disables the dataset inputs when readOnly', () => {
    render(
      <DashboardWidgetInspector
        {...baseProps}
        readOnly
        draft={{ widgets: [widget({ dataset: 'sales_pipeline' })] }}
        selection={{ kind: 'widget', id: 'w1' }}
        onPatch={vi.fn()}
      />,
    );
    expect(labelledInput('Dataset')).toBeDisabled();
    expect(labelledInput('Dimensions')).toBeDisabled();
  });
});

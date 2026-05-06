/**
 * Tests for the dependent-lookups feature: `field.depends_on` should add
 * an `$filter` chain when querying, gate the trigger when dependencies are
 * empty, and re-fetch when the dependency value changes.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { LookupField } from './widgets/LookupField';

const mockDataSource = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDataSource.find.mockResolvedValue({ data: [], total: 0 });
});

describe('LookupField — depends_on', () => {
  const baseField: any = {
    name: 'city',
    type: 'lookup',
    reference: 'cities',
    display_field: 'name',
    id_field: 'id',
    depends_on: ['country'],
  };

  it('disables the trigger when a dependency value is missing', () => {
    render(
      <LookupField
        field={baseField}
        value={null}
        onChange={vi.fn()}
        readonly={false}
        dataSource={mockDataSource as any}
        dependentValues={{}}
      />,
    );
    const trigger = screen.getByTestId('lookup-trigger-gated');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent(/Select country first/i);
  });

  it('enables the trigger and includes a filter chain once the dependency is set', async () => {
    render(
      <LookupField
        field={baseField}
        value={null}
        onChange={vi.fn()}
        readonly={false}
        dataSource={mockDataSource as any}
        dependentValues={{ country: 'US' }}
      />,
    );
    // Trigger is enabled (no gated test id).
    expect(screen.queryByTestId('lookup-trigger-gated')).not.toBeInTheDocument();

    // Open the popover to fire fetch.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /select|search/i }));
    });

    await waitFor(() => expect(mockDataSource.find).toHaveBeenCalled());
    const [, params] = mockDataSource.find.mock.calls[0];
    expect(params.$filter).toEqual({ country: 'US' });
  });

  it('supports the explicit { field, param } shape', async () => {
    const explicitField: any = {
      ...baseField,
      depends_on: [{ field: 'country', param: 'country_id' }],
    };
    render(
      <LookupField
        field={explicitField}
        value={null}
        onChange={vi.fn()}
        readonly={false}
        dataSource={mockDataSource as any}
        dependentValues={{ country: 42 }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /select|search/i }));
    });
    await waitFor(() => expect(mockDataSource.find).toHaveBeenCalled());
    const [, params] = mockDataSource.find.mock.calls[0];
    // numeric value, no quoting
    expect(params.$filter).toEqual({ country_id: 42 });
  });

  it('re-fetches when the dependency value changes while the picker is open', async () => {
    function Harness() {
      const [country, setCountry] = useState('US');
      return (
        <div>
          <button data-testid="set-uk" onClick={() => setCountry('UK')}>UK</button>
          <LookupField
            field={baseField}
            value={null}
            onChange={vi.fn()}
            readonly={false}
            dataSource={mockDataSource as any}
            dependentValues={{ country }}
          />
        </div>
      );
    }
    render(<Harness />);
    // Open the popover.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /select|search/i }));
    });
    await waitFor(() => expect(mockDataSource.find).toHaveBeenCalledTimes(1));

    // Change the dependency — should re-fetch.
    await act(async () => {
      fireEvent.click(screen.getByTestId('set-uk'));
    });
    await waitFor(() => expect(mockDataSource.find).toHaveBeenCalledTimes(2));
    const [, paramsAfter] = mockDataSource.find.mock.calls[1];
    expect(paramsAfter.$filter).toEqual({ country: 'UK' });
  });
});

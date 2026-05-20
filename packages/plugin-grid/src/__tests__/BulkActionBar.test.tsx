/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BulkActionBar } from '../components/BulkActionBar';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));

describe('BulkActionBar', () => {
  it('renders nothing when no actions configured', () => {
    const { container } = render(
      <BulkActionBar selectedRows={rows(2)} actions={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when selection empty', () => {
    const { container } = render(
      <BulkActionBar selectedRows={[]} actions={['delete']} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows N selected for the current-page case', () => {
    render(<BulkActionBar selectedRows={rows(3)} actions={['delete']} />);
    expect(screen.getByText(/3 items selected/i)).toBeTruthy();
  });

  it('does not show cross-page banner when total ≤ page', () => {
    render(
      <BulkActionBar
        selectedRows={rows(5)}
        actions={['delete']}
        pageSize={5}
        totalMatching={5}
      />,
    );
    expect(screen.queryByTestId('bulk-cross-page-banner')).toBeNull();
  });

  it('offers "Select all N matching" when full page is selected and more exist', () => {
    const onSelectAll = vi.fn();
    render(
      <BulkActionBar
        selectedRows={rows(10)}
        actions={['delete']}
        pageSize={10}
        totalMatching={137}
        onSelectAllMatching={onSelectAll}
      />,
    );
    const banner = screen.getByTestId('bulk-cross-page-banner');
    expect(banner.textContent).toMatch(/All 10 on this page are selected/);
    const cta = screen.getByTestId('bulk-select-all-matching');
    expect(cta.textContent).toMatch(/Select all 137 matching/);
    fireEvent.click(cta);
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('shows "all matches selected" summary once user opts in', () => {
    render(
      <BulkActionBar
        selectedRows={rows(10)}
        actions={['delete']}
        pageSize={10}
        totalMatching={137}
        allMatchingSelected
      />,
    );
    expect(screen.getByText(/All 137 matching records are selected/)).toBeTruthy();
    expect(screen.getByText(/137 items selected \(all matches\)/)).toBeTruthy();
    expect(screen.queryByTestId('bulk-select-all-matching')).toBeNull();
  });

  it('calls onClearSelection and clears cross-page when Clear is clicked', () => {
    const onClear = vi.fn();
    render(
      <BulkActionBar
        selectedRows={rows(10)}
        actions={['delete']}
        pageSize={10}
        totalMatching={137}
        allMatchingSelected
        onClearSelection={onClear}
      />,
    );
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

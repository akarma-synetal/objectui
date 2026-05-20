/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u' }, isAuthenticated: true, isLoading: false }),
}));

import { useTrackRouteAsRecent } from '../useTrackRouteAsRecent';
import {
  RecentItemsProvider,
  useRecentItems,
  type RecentItem,
} from '../../context/RecentItemsProvider';
import { UserStateAdaptersProvider } from '../../context/UserStateAdapters';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <UserStateAdaptersProvider>
      <RecentItemsProvider>{children}</RecentItemsProvider>
    </UserStateAdaptersProvider>
  );
}

function useHarness(
  pathname: string,
  appName: string | undefined,
  objects: any[] = [],
  disabled = false,
) {
  useTrackRouteAsRecent({ pathname, appName, objects, disabled });
  const { recentItems } = useRecentItems();
  return recentItems;
}

describe('useTrackRouteAsRecent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('records an object route', () => {
    const { result } = renderHook(
      () =>
        useHarness('/apps/sales/contact', 'sales', [{ name: 'contact', label: 'Contacts' }]),
      { wrapper },
    );
    expect(result.current[0]).toMatchObject({
      id: 'object:contact',
      label: 'Contacts',
      href: '/apps/sales/contact',
      type: 'object',
    });
  });

  it('records a dashboard route', () => {
    const { result } = renderHook(
      () => useHarness('/apps/sales/dashboard/sales_overview', 'sales'),
      { wrapper },
    );
    expect(result.current[0]).toMatchObject({
      id: 'dashboard:sales_overview',
      label: 'Sales Overview',
      type: 'dashboard',
    });
  });

  it('records a page route', () => {
    const { result } = renderHook(
      () => useHarness('/apps/cs/page/welcome-tour', 'cs'),
      { wrapper },
    );
    expect(result.current[0]).toMatchObject({ id: 'page:welcome-tour', type: 'page' });
  });

  it('records a report route', () => {
    const { result } = renderHook(
      () => useHarness('/apps/sales/report/q3-results', 'sales'),
      { wrapper },
    );
    expect(result.current[0]).toMatchObject({ id: 'report:q3-results', type: 'report' });
  });

  it('skips when objectName resolves to a route prefix (e.g. "design")', () => {
    const { result } = renderHook(() => useHarness('/apps/sales/design', 'sales'), {
      wrapper,
    });
    expect(result.current).toEqual([]);
  });

  it('skips when object is unknown', () => {
    const { result } = renderHook(
      () => useHarness('/apps/sales/unknown_obj', 'sales', [{ name: 'contact' }]),
      { wrapper },
    );
    expect(result.current).toEqual([]);
  });

  it('skips when appName is undefined or pathname does not match', () => {
    const { result: r1 } = renderHook(
      () => useHarness('/apps/sales/contact', undefined),
      { wrapper },
    );
    expect(r1.current).toEqual([]);

    const { result: r2 } = renderHook(() => useHarness('/login', 'sales'), { wrapper });
    expect(r2.current).toEqual([]);
  });

  it('does nothing when disabled', () => {
    const { result } = renderHook(
      () =>
        useHarness(
          '/apps/sales/contact',
          'sales',
          [{ name: 'contact', label: 'Contacts' }],
          true,
        ),
      { wrapper },
    );
    expect(result.current).toEqual([]);
  });

  it('records each navigation as pathname changes (rerender)', () => {
    const objects = [
      { name: 'contact', label: 'Contacts' },
      { name: 'order', label: 'Orders' },
    ];
    const { result, rerender } = renderHook(
      ({ p }: { p: string }) => useHarness(p, 'sales', objects),
      { wrapper, initialProps: { p: '/apps/sales/contact' } },
    );

    rerender({ p: '/apps/sales/order' });

    const ids = (result.current as RecentItem[]).map(r => r.id);
    expect(ids).toEqual(['object:order', 'object:contact']);
  });
});

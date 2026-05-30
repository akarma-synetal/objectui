/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackAdapter } from './index';

/**
 * `listViews(object)` feeds the list-view switcher (ObjectView → ViewTabBar),
 * so it must return LIST-family views only. The backend exposes each view as
 * an independent ViewItem carrying a `viewKind` discriminant (ADR-0017); a
 * form-family view (e.g. `crm_activity.default`) must NOT leak in as a tab.
 */
function makeDS(items: any[]) {
  const ds: any = new ObjectStackAdapter({
    baseUrl: 'http://test.local',
    fetch: vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { capabilities: {}, routes: {} } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
  });
  ds.connected = true;
  ds.connectionState = 'connected';
  ds.client = { meta: { getItems: vi.fn(async () => ({ items })) } };
  return ds;
}

describe('ObjectStackDataSource.listViews', () => {
  // The crm_activity view set as the framework expands it.
  const listAll = {
    name: 'crm_activity.all', object: 'crm_activity', viewKind: 'list', isDefault: true,
    label: 'All Activities', config: { type: 'grid', data: { object: 'crm_activity' } },
  };
  const listCalendar = {
    name: 'crm_activity.calendar', object: 'crm_activity', viewKind: 'list',
    label: 'Activity Calendar', config: { type: 'calendar', data: { object: 'crm_activity' } },
  };
  const formDefault = {
    name: 'crm_activity.default', object: 'crm_activity', viewKind: 'form',
    label: 'Activity', config: { type: 'simple' },
  };

  it('excludes form-family ViewItems from the list-view switcher', async () => {
    const ds = makeDS([listAll, listCalendar, formDefault]);
    const views = await ds.listViews('crm_activity');
    const names = views.map((v: any) => v.name).sort();
    expect(names).toEqual(['crm_activity.all', 'crm_activity.calendar']);
    // The form view is the original leak — it must be gone.
    expect(views.find((v: any) => v.name === 'crm_activity.default')).toBeUndefined();
  });

  it('excludes detail-family views too', async () => {
    const detail = { name: 'crm_activity.detail', object: 'crm_activity', viewKind: 'detail', config: {} };
    const ds = makeDS([listAll, detail]);
    const views = await ds.listViews('crm_activity');
    expect(views.map((v: any) => v.name)).toEqual(['crm_activity.all']);
  });

  it('filters by object binding', async () => {
    const otherList = { name: 'crm_lead.all', object: 'crm_lead', viewKind: 'list', config: {} };
    const ds = makeDS([listAll, otherList]);
    const views = await ds.listViews('crm_activity');
    expect(views.map((v: any) => v.name)).toEqual(['crm_activity.all']);
  });

  it('keeps legacy bare specs without a viewKind (saved/list views)', async () => {
    const legacy = { name: 'saved_grid', object: 'crm_activity', type: 'grid' };
    const wrapped = { list: { name: 'wrapped_grid', object: 'crm_activity', type: 'grid' } };
    const ds = makeDS([legacy, wrapped]);
    const views = await ds.listViews('crm_activity');
    expect(views.map((v: any) => v.name).sort()).toEqual(['saved_grid', 'wrapped_grid']);
  });
});

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  isExpandedViewItem,
  viewItemToDraft,
  draftToViewItem,
} from './view-item-normalize';

const calendarItem = {
  name: 'crm_campaign.campaign_calendar',
  object: 'crm_campaign',
  viewKind: 'list',
  label: 'Launch Calendar',
  scope: 'package',
  _provenance: 'package',
  config: {
    name: 'campaign_calendar',
    label: 'Launch Calendar',
    type: 'calendar',
    data: { provider: 'object', object: 'crm_campaign' },
    columns: ['name', 'channel', 'status'],
    calendar: {
      startDateField: 'start_date',
      endDateField: 'end_date',
      titleField: 'name',
      colorField: 'name',
    },
  },
};

const formItem = {
  name: 'crm_lead.intake_form',
  object: 'crm_lead',
  viewKind: 'form',
  label: 'Intake',
  scope: 'shared',
  config: { type: 'simple', data: { object: 'crm_lead' }, sections: [] },
};

describe('isExpandedViewItem', () => {
  it('accepts list-family expanded items', () => {
    expect(isExpandedViewItem(calendarItem)).toBe(true);
  });
  it('accepts form-family expanded items', () => {
    expect(isExpandedViewItem(formItem)).toBe(true);
  });
  it('rejects the bare aggregated container (no viewKind/config)', () => {
    expect(isExpandedViewItem({ name: 'crm_lead', list: {}, listViews: [] })).toBe(false);
  });
  it('rejects a legacy flat view (top-level type, no viewKind)', () => {
    expect(isExpandedViewItem({ name: 'x', type: 'grid', columns: [] })).toBe(false);
  });
  it('rejects viewKind present but config missing/non-object', () => {
    expect(isExpandedViewItem({ name: 'x', viewKind: 'list' })).toBe(false);
    expect(isExpandedViewItem({ name: 'x', viewKind: 'list', config: [] })).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(isExpandedViewItem(null)).toBe(false);
    expect(isExpandedViewItem('view')).toBe(false);
  });
});

describe('viewItemToDraft', () => {
  it('unwraps a list-family config under the `list` family key', () => {
    const draft = viewItemToDraft(calendarItem);
    expect(draft.list).toEqual(calendarItem.config);
    expect((draft as any).config).toBeUndefined();
    // Identity / provenance preserved at top level.
    expect(draft.name).toBe('crm_campaign.campaign_calendar');
    expect(draft.object).toBe('crm_campaign');
    expect(draft.viewKind).toBe('list');
    expect(draft.label).toBe('Launch Calendar');
    expect(draft.scope).toBe('package');
  });

  it('unwraps a form-family config under the `form` family key', () => {
    const draft = viewItemToDraft(formItem);
    expect(draft.form).toEqual(formItem.config);
    expect(draft.list).toBeUndefined();
  });

  it('leaves a non-expanded item unchanged', () => {
    const legacy = { name: 'x', type: 'grid', columns: ['a'] };
    expect(viewItemToDraft(legacy)).toBe(legacy);
  });

  it('coerces nullish input to an empty object', () => {
    expect(viewItemToDraft(null)).toEqual({});
  });
});

describe('draftToViewItem', () => {
  it('is the inverse of viewItemToDraft for a list view', () => {
    const draft = viewItemToDraft(calendarItem);
    const back = draftToViewItem(draft);
    expect(back).toEqual(calendarItem);
  });

  it('is the inverse for a form view', () => {
    expect(draftToViewItem(viewItemToDraft(formItem))).toEqual(formItem);
  });

  it('folds back edits made to the family variant', () => {
    const draft = viewItemToDraft(calendarItem) as any;
    draft.list = { ...draft.list, columns: ['name', 'channel'] };
    const back = draftToViewItem(draft) as any;
    expect(back.config.columns).toEqual(['name', 'channel']);
    expect(back.viewKind).toBe('list');
  });

  it('no-ops on a draft without the viewKind discriminant', () => {
    const legacy = { name: 'x', type: 'grid', columns: ['a'] };
    expect(draftToViewItem(legacy)).toBe(legacy);
  });

  it('no-ops when the family object is absent', () => {
    const d = { name: 'x', viewKind: 'list' };
    expect(draftToViewItem(d)).toBe(d);
  });
});

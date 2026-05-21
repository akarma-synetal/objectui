/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDefaultPageSchema,
  detectStatusField,
  deriveStages,
  deriveHighlightFields,
  type ObjectDefLike,
} from '../buildDefaultPageSchema';

const leadDef: ObjectDefLike = {
  name: 'lead',
  label: 'Lead',
  fields: {
    first_name: { name: 'first_name', label: 'First Name', type: 'text' },
    last_name: { name: 'last_name', label: 'Last Name', type: 'text' },
    email: { name: 'email', label: 'Email', type: 'email' },
    phone: { name: 'phone', label: 'Phone', type: 'phone' },
    rating: { name: 'rating', label: 'Rating', type: 'text' },
    source: { name: 'source', label: 'Source', type: 'text' },
    owner_id: { name: 'owner_id', label: 'Owner', type: 'lookup' },
    status: {
      name: 'status',
      label: 'Status',
      type: 'picklist',
      options: [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'qualified', label: 'Qualified' },
      ],
    },
    created_at: { name: 'created_at', label: 'Created', type: 'datetime' },
  },
};

describe('detectStatusField', () => {
  it('returns null for undefined def', () => {
    expect(detectStatusField(undefined)).toBeNull();
  });

  it('honours explicit stageField', () => {
    expect(detectStatusField({ stageField: 'pipeline', fields: { pipeline: {} } }))
      .toBe('pipeline');
  });

  it('picks status by name', () => {
    expect(detectStatusField(leadDef)).toBe('status');
  });

  it('falls back to stage / state / phase', () => {
    expect(detectStatusField({ fields: { stage: {} } })).toBe('stage');
    expect(detectStatusField({ fields: { state: {} } })).toBe('state');
    expect(detectStatusField({ fields: { phase: {} } })).toBe('phase');
  });

  it('detects by type=status when no canonical name present', () => {
    expect(
      detectStatusField({ fields: { lifecycle: { type: 'status' } } }),
    ).toBe('lifecycle');
  });

  it('returns null when nothing matches', () => {
    expect(detectStatusField({ fields: { foo: {} } })).toBeNull();
  });
});

describe('deriveStages', () => {
  it('returns null when statusField missing', () => {
    expect(deriveStages(leadDef, null)).toBeNull();
  });

  it('returns null when field has no options', () => {
    expect(deriveStages({ fields: { status: {} } }, 'status')).toBeNull();
  });

  it('maps picklist options to {value,label}', () => {
    expect(deriveStages(leadDef, 'status')).toEqual([
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'qualified', label: 'Qualified' },
    ]);
  });
});

describe('deriveHighlightFields', () => {
  it('honours explicit objectDef.highlightFields', () => {
    expect(deriveHighlightFields({ ...leadDef, highlightFields: ['email', 'phone'] }, 'status'))
      .toEqual(['email', 'phone']);
  });

  it('caps explicit list at max', () => {
    expect(
      deriveHighlightFields(
        { ...leadDef, highlightFields: ['a', 'b', 'c', 'd', 'e', 'f'] },
        null,
        3,
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  it('prefers owner / rating / source / phone / email and skips status', () => {
    const fields = deriveHighlightFields(leadDef, 'status');
    expect(fields).not.toContain('status');
    expect(fields).not.toContain('created_at');
    expect(fields).toContain('owner_id');
    expect(fields.length).toBeLessThanOrEqual(4);
  });

  it('falls back to any field order when preferred names absent', () => {
    const def: ObjectDefLike = { fields: { foo: {}, bar: {}, baz: {} } };
    expect(deriveHighlightFields(def, null)).toEqual(['foo', 'bar', 'baz']);
  });
});

describe('buildDefaultPageSchema', () => {
  it('emits a record Page with full-width template + main region', () => {
    const page = buildDefaultPageSchema(leadDef);
    expect(page.type).toBe('record');
    expect(page.pageType).toBe('record');
    expect(page.object).toBe('lead');
    expect(page.template).toBe('full-width');
    expect(page.regions).toHaveLength(1);
    expect(page.regions[0].name).toBe('main');
  });

  it('emits page:header, record:highlights, record:path, page:tabs, record:discussion', () => {
    const types = buildDefaultPageSchema(leadDef).regions[0].components.map(
      (c: any) => c.type,
    );
    expect(types).toEqual([
      'page:header',
      'record:highlights',
      'record:path',
      'page:tabs',
      'record:discussion',
    ]);
  });

  it('omits record:path when no status field', () => {
    const def: ObjectDefLike = { name: 'note', fields: { body: {} } };
    const types = buildDefaultPageSchema(def).regions[0].components.map(
      (c: any) => c.type,
    );
    expect(types).not.toContain('record:path');
  });

  it('omits record:highlights when no fields derivable', () => {
    const def: ObjectDefLike = { name: 'empty', fields: {} };
    const types = buildDefaultPageSchema(def).regions[0].components.map(
      (c: any) => c.type,
    );
    expect(types).not.toContain('record:highlights');
  });

  it('hideDiscussion drops record:discussion', () => {
    const types = buildDefaultPageSchema(leadDef, { hideDiscussion: true })
      .regions[0].components.map((c: any) => c.type);
    expect(types).not.toContain('record:discussion');
  });

  it('hideHighlights / hidePath each drop their component', () => {
    const types = buildDefaultPageSchema(leadDef, {
      hideHighlights: true,
      hidePath: true,
    }).regions[0].components.map((c: any) => c.type);
    expect(types).not.toContain('record:highlights');
    expect(types).not.toContain('record:path');
  });

  it('options override auto-derivation', () => {
    const page = buildDefaultPageSchema(leadDef, {
      highlightFields: ['email'],
      statusField: 'rating',
      stages: [{ value: 'hot', label: 'Hot' }],
    });
    const hl = page.regions[0].components.find((c: any) => c.type === 'record:highlights');
    const path = page.regions[0].components.find((c: any) => c.type === 'record:path');
    expect(hl.fields).toEqual(['email']);
    expect(path.statusField).toBe('rating');
    expect(path.stages).toEqual([{ value: 'hot', label: 'Hot' }]);
  });

  it('page:header.recordChrome defaults to true and can be turned off', () => {
    const on = buildDefaultPageSchema(leadDef).regions[0].components[0];
    const off = buildDefaultPageSchema(leadDef, { recordChrome: false }).regions[0].components[0];
    expect(on.recordChrome).toBe(true);
    expect(off.recordChrome).toBe(false);
  });

  it('page:tabs always carries a details tab containing record:details', () => {
    const tabs = buildDefaultPageSchema(leadDef).regions[0].components.find(
      (c: any) => c.type === 'page:tabs',
    );
    expect(tabs.items).toHaveLength(1);
    expect(tabs.items[0].label).toBe('Details');
    expect(tabs.items[0].children[0].type).toBe('record:details');
  });

  it('handles undefined def gracefully', () => {
    const page = buildDefaultPageSchema(undefined);
    expect(page.type).toBe('record');
    expect(page.object).toBeUndefined();
    const types = page.regions[0].components.map((c: any) => c.type);
    // Should still emit page:header + page:tabs + record:discussion;
    // no highlights / path because the def is empty.
    expect(types).toEqual(['page:header', 'page:tabs', 'record:discussion']);
  });

  describe('slice 4 — headerActions / related / activity / history', () => {
    it('emits record:quick_actions after page:header when headerActions provided', () => {
      const page = buildDefaultPageSchema(leadDef, {
        headerActions: [
          { name: 'edit', label: 'Edit', locations: ['record_header'] },
        ],
      });
      const types = page.regions[0].components.map((c: any) => c.type);
      expect(types[0]).toBe('page:header');
      expect(types[1]).toBe('record:quick_actions');
      const qa = page.regions[0].components[1];
      expect(qa.actions).toHaveLength(1);
      expect(qa.location).toBe('record_header');
    });

    it('omits record:quick_actions when headerActions empty or absent', () => {
      const noOpt = buildDefaultPageSchema(leadDef);
      const emptyOpt = buildDefaultPageSchema(leadDef, { headerActions: [] });
      const types1 = noOpt.regions[0].components.map((c: any) => c.type);
      const types2 = emptyOpt.regions[0].components.map((c: any) => c.type);
      expect(types1).not.toContain('record:quick_actions');
      expect(types2).not.toContain('record:quick_actions');
    });

    it('emits Related tab with one record:related_list per entry', () => {
      const page = buildDefaultPageSchema(leadDef, {
        related: [
          {
            objectName: 'task',
            relationshipField: 'lead_id',
            title: 'Tasks',
            limit: 10,
          },
          {
            objectName: 'note',
            relationshipField: 'parent_id',
          },
        ],
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items).toHaveLength(2);
      expect(tabs.items[1].label).toBe('Related');
      expect(tabs.items[1].children).toHaveLength(2);
      expect(tabs.items[1].children[0].type).toBe('record:related_list');
      expect(tabs.items[1].children[0].objectName).toBe('task');
      expect(tabs.items[1].children[0].relationshipField).toBe('lead_id');
      expect(tabs.items[1].children[0].limit).toBe(10);
    });

    it('emits Activity tab when showActivity is true', () => {
      const page = buildDefaultPageSchema(leadDef, { showActivity: true });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      const labels = tabs.items.map((t: any) => t.label);
      expect(labels).toContain('Activity');
      const act = tabs.items.find((t: any) => t.label === 'Activity');
      expect(act.children[0].type).toBe('record:activity');
    });

    it('emits History tab with entries when history option provided', () => {
      const entries = [
        { id: '1', timestamp: '2025-01-01', action: 'created' },
      ];
      const page = buildDefaultPageSchema(leadDef, {
        history: { entries, loading: false },
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      const hist = tabs.items.find((t: any) => t.label === 'History');
      expect(hist).toBeDefined();
      expect(hist.children[0].type).toBe('record:history');
      expect(hist.children[0].entries).toEqual(entries);
      expect(hist.children[0].loading).toBe(false);
    });

    it('Details / Related / Activity / History tab order is stable', () => {
      const page = buildDefaultPageSchema(leadDef, {
        related: [{ objectName: 'task', relationshipField: 'lead_id' }],
        showActivity: true,
        history: { entries: [], loading: false },
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items.map((t: any) => t.label)).toEqual([
        'Details',
        'Related',
        'Activity',
        'History',
      ]);
    });
  });
});

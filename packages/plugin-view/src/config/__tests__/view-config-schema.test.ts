/**
 * Tests for the simplified `essentialOnly` mode of `buildViewConfigSchema`.
 *
 * Locks down the Airtable-parity behavior:
 * - Only general / data / appearance sections render.
 * - Within data, only the 6 essential fields render.
 * - Within appearance, only color / rowHeight / conditionalFormatting render.
 * - In full mode, every section + every field is present.
 */

import { describe, it, expect } from 'vitest';
import { buildViewConfigSchema, ESSENTIAL_SECTION_KEYS } from '../view-config-schema';

const noopT = (key: string, params?: Record<string, any>) =>
    (params && typeof params.defaultValue === 'string') ? params.defaultValue : key;

const baseOpts = {
    t: noopT,
    fieldOptions: [
        { value: 'name', label: 'Name', type: 'text' as const },
        { value: 'status', label: 'Status', type: 'select' as const, options: [{ value: 'a', label: 'A' }] },
    ],
    objectDef: { name: 'lead', label: 'Lead', fields: { name: { type: 'text' }, status: { type: 'select' } } },
    updateField: () => { /* noop */ },
    filterGroupValue: { logic: 'and' as const, conditions: [] },
    sortItemsValue: [],
};

describe('buildViewConfigSchema — essentialOnly mode (Airtable parity)', () => {
    it('only renders general/data/appearance sections', () => {
        const schema = buildViewConfigSchema({ ...baseOpts, essentialOnly: true });
        const keys = schema.sections.map(s => s.key);
        expect(keys).toEqual([...ESSENTIAL_SECTION_KEYS]);
        for (const k of ['toolbar', 'navigation', 'records', 'exportPrint', 'userActions', 'sharing', 'accessibility']) {
            expect(keys).not.toContain(k);
        }
    });

    it('data section is restricted to essential fields only', () => {
        const schema = buildViewConfigSchema({ ...baseOpts, essentialOnly: true });
        const data = schema.sections.find(s => s.key === 'data');
        expect(data).toBeDefined();
        const fieldKeys = data!.fields.map(f => f.key);
        for (const k of ['_source', '_columns', '_filterBy', '_sortBy', '_grouping', '_typeOptions']) {
            expect(fieldKeys).toContain(k);
        }
        for (const k of ['_pageSize', '_pageSizeOptions', '_searchableFields', '_filterableFields', '_hiddenFields', '_quickFilters', '_userFilters']) {
            expect(fieldKeys).not.toContain(k);
        }
    });

    it('appearance section is restricted to color/rowHeight/conditionalFormatting', () => {
        const schema = buildViewConfigSchema({ ...baseOpts, essentialOnly: true });
        const appearance = schema.sections.find(s => s.key === 'appearance');
        expect(appearance).toBeDefined();
        const fieldKeys = appearance!.fields.map(f => f.key);
        expect(fieldKeys).toEqual(expect.arrayContaining(['color', 'rowHeight', '_conditionalFormatting']));
        for (const k of ['striped', 'bordered', 'wrapHeaders', 'showDescription', 'resizable', '_emptyState']) {
            expect(fieldKeys).not.toContain(k);
        }
    });

    it('appearance is expanded by default in essential mode (small enough)', () => {
        const schema = buildViewConfigSchema({ ...baseOpts, essentialOnly: true });
        const appearance = schema.sections.find(s => s.key === 'appearance');
        expect(appearance!.defaultCollapsed).toBe(false);
    });
});

describe('buildViewConfigSchema — full mode (advanced settings on)', () => {
    it('renders every section', () => {
        const schema = buildViewConfigSchema({ ...baseOpts, essentialOnly: false });
        const keys = schema.sections.map(s => s.key);
        for (const k of ['general', 'toolbar', 'navigation', 'records', 'exportPrint', 'data', 'appearance', 'userActions', 'sharing', 'accessibility']) {
            expect(keys).toContain(k);
        }
    });

    it('data section includes all advanced fields', () => {
        const schema = buildViewConfigSchema({ ...baseOpts, essentialOnly: false });
        const data = schema.sections.find(s => s.key === 'data');
        const fieldKeys = data!.fields.map(f => f.key);
        for (const k of ['_pageSize', '_pageSizeOptions', '_searchableFields', '_filterableFields', '_hiddenFields', '_quickFilters', '_userFilters']) {
            expect(fieldKeys).toContain(k);
        }
    });
});

/**
 * Pure-helper tests for the ImportWizard mapping-template + correction
 * machinery. These run in node ('unit' project) and avoid the workspace's
 * shared module cache that defeats UI-level vi.mock.
 */
import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';

const { mappingToTemplatePayload, applyTemplate, loadTemplates, saveTemplates, autoMapColumns } = __testables;

class MemStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const fields = [
  { name: 'name', label: 'Name', type: 'string', required: true },
  { name: 'email', label: 'Email', type: 'string', required: true },
  { name: 'age', label: 'Age', type: 'number' },
];

describe('ImportWizard helpers — templates', () => {
  it('mappingToTemplatePayload uses lowercased header names', () => {
    const headers = ['Full Name', 'Email Address', 'Age'];
    const mapping = { 0: 'name', 2: 'age' };
    expect(mappingToTemplatePayload(headers, mapping)).toEqual({
      'full name': 'name',
      'age': 'age',
    });
  });

  it('applyTemplate rebuilds an index map from header names, ignoring unknown fields', () => {
    const tpl = {
      id: 't', name: 'T', updatedAt: 0,
      mapping: { 'full name': 'name', 'age': 'age', 'phone': 'phone_unknown' },
    };
    const headers = ['AGE', 'Foo', 'Full Name'];
    const result = applyTemplate(tpl, headers, fields);
    expect(result).toEqual({ 0: 'age', 2: 'name' });
  });

  it('saveTemplates + loadTemplates round-trip through storage', () => {
    const store = new MemStore();
    const templates = [
      { id: 't1', name: 'A', mapping: { name: 'name' }, updatedAt: 1 },
      { id: 't2', name: 'B', mapping: { email: 'email' }, updatedAt: 2 },
    ];
    saveTemplates(store, 'k', templates);
    expect(loadTemplates(store, 'k')).toEqual(templates);
  });

  it('loadTemplates returns [] for missing keys, malformed JSON, and non-array data', () => {
    const store = new MemStore();
    expect(loadTemplates(store, 'k')).toEqual([]);
    store.setItem('k', '{not json');
    expect(loadTemplates(store, 'k')).toEqual([]);
    store.setItem('k', '"hello"');
    expect(loadTemplates(store, 'k')).toEqual([]);
  });

  it('loadTemplates filters out malformed entries (missing id/name/mapping)', () => {
    const store = new MemStore();
    store.setItem('k', JSON.stringify([
      { id: 'ok', name: 'OK', mapping: {} },
      { id: 'bad' },
      null,
      { name: 'no-id', mapping: {} },
    ]));
    const out = loadTemplates(store, 'k');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('ok');
  });

  it('saveTemplates is a no-op when storage is null', () => {
    expect(() => saveTemplates(null, 'k', [])).not.toThrow();
  });

  it('autoMapColumns matches headers against both name and label, ignoring case + separators', () => {
    expect(autoMapColumns(['Full_Name', 'E-Mail', 'AGE', 'Other'], fields)).toEqual({
      // 'Full_Name' becomes 'fullname' which matches neither name nor label →
      // not auto-mapped (templates handle that). 'E-Mail' → 'email' matches.
      1: 'email',
      2: 'age',
    });
  });
});

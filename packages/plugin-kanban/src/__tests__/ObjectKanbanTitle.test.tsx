/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

/**
 * Tests for the title resolution fallback chain in ObjectKanban.
 *
 * The effectiveData logic tries fields in this order:
 *   1. Explicit cardTitle / titleField from schema (when it yields a value)
 *   2. objectDef.titleFormat — rendered as a template (e.g. "{full_name} - {company}")
 *   3. objectDef.NAME_FIELD_KEY
 *   4. Fallback chain: name → full_name → fullName → title → subject → label → display_name → displayName
 *   5. 'Untitled'
 *
 * Steps 2-4 always run when step 1 does not produce a value, even when an
 * explicit titleField was supplied — this protects records whose configured
 * field is missing (e.g. ListView previously defaulted titleField to "name"
 * for objects whose primary field is actually `full_name`).
 */

const TITLE_FALLBACK_FIELDS = [
  'name',
  'full_name',
  'fullName',
  'title',
  'subject',
  'label',
  'display_name',
  'displayName',
];

function renderFromTemplate(template: string, item: Record<string, any>): string {
  let anyResolved = false;
  const out = template.replace(/\{(.+?)\}/g, (_m, key) => {
    const v = item[key.trim()];
    if (v !== undefined && v !== null && v !== '') {
      anyResolved = true;
      return String(v);
    }
    return '';
  }).replace(/\s+-\s+(?=$|\s*$)/, '').trim();
  return anyResolved ? out : '';
}

function resolveTitle(
  item: Record<string, any>,
  titleField?: string,
  objectDef?: { titleFormat?: string; NAME_FIELD_KEY?: string },
): string {
  let resolvedTitle: any = undefined;

  if (titleField) {
    resolvedTitle = item[titleField];
    if (typeof resolvedTitle === 'string') resolvedTitle = resolvedTitle.trim();
  }

  if (!resolvedTitle && objectDef?.titleFormat) {
    const rendered = renderFromTemplate(objectDef.titleFormat, item);
    if (rendered) resolvedTitle = rendered;
  }

  if (!resolvedTitle && objectDef?.NAME_FIELD_KEY) {
    const v = item[objectDef.NAME_FIELD_KEY];
    if (typeof v === 'string') resolvedTitle = v.trim();
    else if (v) resolvedTitle = v;
  }

  if (!resolvedTitle) {
    for (const field of TITLE_FALLBACK_FIELDS) {
      const v = item[field];
      const s = typeof v === 'string' ? v.trim() : v;
      if (s) {
        resolvedTitle = s;
        break;
      }
    }
  }

  return resolvedTitle || 'Untitled';
}

describe('ObjectKanban title resolution', () => {
  it('uses explicit titleField when value exists', () => {
    const item = { id: '1', custom_title: 'My Custom Title', name: 'Fallback Name' };
    expect(resolveTitle(item, 'custom_title')).toBe('My Custom Title');
  });

  it('falls back to common fields when titleField value is empty', () => {
    const item = { id: '1', custom_title: '', name: 'Name Field' };
    expect(resolveTitle(item, 'custom_title')).toBe('Name Field');
  });

  it('resolves name field first in fallback chain', () => {
    const item = { id: '1', name: 'Name Value', title: 'Title Value', subject: 'Subject Value' };
    expect(resolveTitle(item)).toBe('Name Value');
  });

  it('resolves full_name when name is absent', () => {
    const item = { id: '1', full_name: ' Alice Martinez', company: 'NextGen Retail' };
    expect(resolveTitle(item)).toBe('Alice Martinez');
  });

  it('falls back through to objectDef.titleFormat when explicit titleField yields nothing', () => {
    // Mirrors the lead-object regression: ListView defaulted titleField to
    // "name" but the object has no `name` field — only full_name + titleFormat.
    const item = { id: '1', full_name: 'Alice Martinez', company: 'NextGen Retail' };
    const objectDef = { titleFormat: '{full_name} - {company}' };
    expect(resolveTitle(item, 'name', objectDef)).toBe('Alice Martinez - NextGen Retail');
  });

  it('renders titleFormat with multiple placeholders', () => {
    const item = { id: '1', first_name: 'Alice', last_name: 'Martinez' };
    const objectDef = { titleFormat: '{first_name} {last_name}' };
    expect(resolveTitle(item, undefined, objectDef)).toBe('Alice Martinez');
  });

  it('drops trailing dash separator when right side of titleFormat is empty', () => {
    const item = { id: '1', full_name: 'Alice Martinez', company: '' };
    const objectDef = { titleFormat: '{full_name} - {company}' };
    expect(resolveTitle(item, undefined, objectDef)).toBe('Alice Martinez');
  });

  it('uses NAME_FIELD_KEY when neither explicit field nor titleFormat resolves', () => {
    const item = { id: '1', display_label: 'Custom Label' };
    const objectDef = { NAME_FIELD_KEY: 'display_label' };
    expect(resolveTitle(item, undefined, objectDef)).toBe('Custom Label');
  });

  it('resolves title field after name in fallback chain', () => {
    const item = { id: '1', title: 'Title Value', subject: 'Subject Value' };
    expect(resolveTitle(item)).toBe('Title Value');
  });

  it('resolves subject field in fallback chain', () => {
    const item = { id: '1', subject: 'Subject Value', label: 'Label Value' };
    expect(resolveTitle(item)).toBe('Subject Value');
  });

  it('resolves label field in fallback chain', () => {
    const item = { id: '1', label: 'Label Value', display_name: 'Display Name' };
    expect(resolveTitle(item)).toBe('Label Value');
  });

  it('resolves display_name field in fallback chain', () => {
    const item = { id: '1', display_name: 'Display Name' };
    expect(resolveTitle(item)).toBe('Display Name');
  });

  it('falls back to Untitled when no common fields exist', () => {
    const item = { id: '1', status: 'open', priority: 'high' };
    expect(resolveTitle(item)).toBe('Untitled');
  });

  it('skips falsy field values in fallback chain', () => {
    const item = { id: '1', name: '', title: null, subject: 'Bug Report' };
    expect(resolveTitle(item)).toBe('Bug Report');
  });

  it('handles todo_task objects with subject field', () => {
    const todoTask = { id: '1', status: 'in_progress', subject: 'Fix login bug', priority: 'high' };
    expect(resolveTitle(todoTask)).toBe('Fix login bug');
  });
});

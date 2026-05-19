/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Licensed under the MIT license; see LICENSE in the repo root.
 */

import { describe, expect, it } from 'vitest';
import { validateJoinedBlocks } from '../JoinedBlocksEditor';

const t = (key: string) => key;

describe('validateJoinedBlocks', () => {
  it('flags an empty blocks array as needing blocks', () => {
    expect(validateJoinedBlocks([], t)).toContain('report.editor.validationJoinedNeedsBlocks');
  });

  it('flags non-array (undefined) as needing blocks', () => {
    expect(validateJoinedBlocks(undefined, t)).toContain('report.editor.validationJoinedNeedsBlocks');
  });

  it('flags blocks missing a name', () => {
    const issues = validateJoinedBlocks(
      [{ name: '', columns: [{ field: 'a' }] }, { name: 'ok', columns: [{ field: 'a' }] }],
      t,
    );
    expect(issues).toContain('report.editor.validationBlockNameRequired');
  });

  it('flags duplicate block names', () => {
    const issues = validateJoinedBlocks(
      [
        { name: 'dup', columns: [{ field: 'a' }] },
        { name: 'dup', columns: [{ field: 'a' }] },
      ],
      t,
    );
    expect(issues).toContain('report.editor.validationBlockNameDuplicate');
  });

  it('flags blocks without columns', () => {
    const issues = validateJoinedBlocks(
      [
        { name: 'a', columns: [] },
        { name: 'b', columns: [{ field: 'x' }] },
      ],
      t,
    );
    expect(issues).toContain('report.editor.validationBlockNeedsColumns');
  });

  it('returns no issues for well-formed blocks', () => {
    const issues = validateJoinedBlocks(
      [
        { name: 'a', columns: [{ field: 'x' }] },
        { name: 'b', columns: [{ field: 'y' }] },
      ],
      t,
    );
    expect(issues).toEqual([]);
  });

  it('treats whitespace-only name as missing', () => {
    const issues = validateJoinedBlocks([{ name: '   ', columns: [{ field: 'x' }] }], t);
    expect(issues).toContain('report.editor.validationBlockNameRequired');
  });
});

// ---------------------------------------------------------------------------
// RTL smoke tests for JoinedBlocksEditor — verify the resolver picks the
// right field list per block.
// ---------------------------------------------------------------------------

import * as React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { JoinedBlocksEditor } from '../JoinedBlocksEditor';

const accountFields = [
  { value: 'industry', label: 'Industry', type: 'select' },
  { value: 'annual_revenue', label: 'Annual Revenue', type: 'currency' },
];
const contactFields = [
  { value: 'first_name', label: 'First Name', type: 'text' },
  { value: 'email', label: 'Email', type: 'email' },
];

function getFieldsForObject(name: string | undefined) {
  if (name === 'account') return accountFields;
  if (name === 'contact') return contactFields;
  return undefined;
}

describe('JoinedBlocksEditor', () => {
  it('resolves block-specific fields when the block overrides objectName', () => {
    const blocks = [
      { name: 'b_account', type: 'tabular', columns: [{ field: 'industry' }] },
      { name: 'b_contact', type: 'tabular', objectName: 'contact', columns: [{ field: 'first_name' }] },
    ];

    render(
      React.createElement(JoinedBlocksEditor, {
        value: blocks,
        onChange: () => {},
        availableFields: accountFields,
        getFieldsForObject,
        containerObjectName: 'account',
        t: (k: string) => k,
      }),
    );

    // First block is expanded by default and uses container (account) fields.
    // ColumnsEditor lists unselected fields as labels — Industry is already
    // selected so we look for Annual Revenue.
    const card1 = screen.getByTestId('joined-block-0');
    expect(within(card1).getByText('Annual Revenue')).toBeTruthy();
    expect(within(card1).queryByText('Email')).toBeNull();

    // Expand the second block and verify it sees contact fields only.
    const toggle2 = screen.getByTestId('joined-block-toggle-1');
    fireEvent.click(toggle2);
    const card2 = screen.getByTestId('joined-block-1');
    expect(within(card2).getByText('Email')).toBeTruthy();
    expect(within(card2).queryByText('Annual Revenue')).toBeNull();
  });

  it('falls back to availableFields when the resolver returns undefined', () => {
    const blocks = [
      { name: 'b_unknown', type: 'tabular', objectName: 'mystery_object', columns: [] },
    ];

    render(
      React.createElement(JoinedBlocksEditor, {
        value: blocks,
        onChange: () => {},
        availableFields: accountFields,
        getFieldsForObject,
        containerObjectName: 'account',
        t: (k: string) => k,
      }),
    );

    const card = screen.getByTestId('joined-block-0');
    expect(within(card).getByText('Industry')).toBeTruthy();
    expect(within(card).getByText('Annual Revenue')).toBeTruthy();
  });

  it('add-block appends a uniquely-named block', () => {
    let captured: any = null;
    render(
      React.createElement(JoinedBlocksEditor, {
        value: [{ name: 'block_1', type: 'tabular', columns: [] }],
        onChange: (next: any) => {
          captured = next;
        },
        availableFields: accountFields,
        t: (k: string) => k,
      }),
    );
    fireEvent.click(screen.getByTestId('joined-block-add'));
    expect(captured).toBeTruthy();
    expect(captured).toHaveLength(2);
    expect(captured[1].name).toBe('block_2');
  });

  it('shows the empty-state validation hint when blocks is empty', () => {
    render(
      React.createElement(JoinedBlocksEditor, {
        value: [],
        onChange: () => {},
        availableFields: accountFields,
        t: (k: string) => k,
      }),
    );
    expect(screen.getByText('report.editor.validationJoinedNeedsBlocks')).toBeTruthy();
  });

  it('flags duplicate names inline on the block card', () => {
    render(
      React.createElement(JoinedBlocksEditor, {
        value: [
          { name: 'same', type: 'tabular', columns: [{ field: 'industry' }] },
          { name: 'same', type: 'tabular', columns: [{ field: 'industry' }] },
        ],
        onChange: () => {},
        availableFields: accountFields,
        t: (k: string) => k,
      }),
    );
    const errors = screen.getAllByText('report.editor.validationBlockNameDuplicate');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

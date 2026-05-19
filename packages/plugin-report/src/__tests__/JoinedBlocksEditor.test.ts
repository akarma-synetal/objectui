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

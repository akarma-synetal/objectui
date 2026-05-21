/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { cleanupTitleSeparators } from '../renderers/layout/containers';

describe('cleanupTitleSeparators', () => {
  it('returns empty input unchanged', () => {
    expect(cleanupTitleSeparators('')).toBe('');
  });

  it('preserves a clean title', () => {
    expect(cleanupTitleSeparators('CTR-0001 - Acme Contract')).toBe('CTR-0001 - Acme Contract');
  });

  it('strips a trailing dash from a missing tail interpolation', () => {
    expect(cleanupTitleSeparators('CTR-0001 -')).toBe('CTR-0001');
    expect(cleanupTitleSeparators('CTR-0001 - ')).toBe('CTR-0001');
  });

  it('strips a trailing middle-dot or colon connector', () => {
    expect(cleanupTitleSeparators('Acme ·')).toBe('Acme');
    expect(cleanupTitleSeparators('Status :')).toBe('Status');
  });

  it('strips a leading dash from a missing head interpolation', () => {
    expect(cleanupTitleSeparators('- Acme')).toBe('Acme');
    expect(cleanupTitleSeparators(' · Acme')).toBe('Acme');
  });

  it('collapses double separators left by an empty middle field', () => {
    expect(cleanupTitleSeparators('A -  - B')).toBe('A - B');
    expect(cleanupTitleSeparators('A · · B')).toBe('A · B');
  });

  it('handles em-dash and en-dash connectors', () => {
    expect(cleanupTitleSeparators('CTR-0001 —')).toBe('CTR-0001');
    expect(cleanupTitleSeparators('CTR-0001 –')).toBe('CTR-0001');
  });

  it('does not strip dashes inside an identifier', () => {
    expect(cleanupTitleSeparators('CTR-0001')).toBe('CTR-0001');
  });

  it('collapses runs of whitespace', () => {
    expect(cleanupTitleSeparators('A   B')).toBe('A B');
  });

  it('is idempotent', () => {
    const once = cleanupTitleSeparators('CTR-0001 - ');
    expect(cleanupTitleSeparators(once)).toBe(once);
  });
});

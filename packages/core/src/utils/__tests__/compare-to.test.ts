/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { shiftFilterByCompareTo, compareToTrendLabelKey } from '../compare-to';

describe('shiftFilterByCompareTo', () => {
  // Fixed reference: Monday 2026-05-25 (Q2 2026, week starts Monday).
  const now = new Date(2026, 4, 25, 12, 30, 0);

  describe('previousPeriod', () => {
    it('substitutes current_* tokens with last_* before resolving', () => {
      const filter = {
        created_at: {
          $gte: '{current_quarter_start}',
          $lte: '{current_quarter_end}',
        },
      };
      const out = shiftFilterByCompareTo(filter, 'previousPeriod', now);
      // Q2 2026 → Q1 2026 (2026-01-01 .. 2026-03-31)
      expect(out.created_at.$gte).toBe('2026-01-01');
      expect(out.created_at.$lte).toBe('2026-03-31');
    });

    it('substitutes today → yesterday', () => {
      const out = shiftFilterByCompareTo({ at: '{today}' }, 'previousPeriod', now);
      expect(out.at).toBe('2026-05-24');
    });

    it('substitutes bare aliases (month_start / month_end)', () => {
      const out = shiftFilterByCompareTo(
        { d: { $gte: '{month_start}', $lte: '{month_end}' } },
        'previousPeriod',
        now,
      );
      // May 2026 → April 2026
      expect(out.d.$gte).toBe('2026-04-01');
      expect(out.d.$lte).toBe('2026-04-30');
    });

    it('passes filters with no date tokens through unchanged', () => {
      const out = shiftFilterByCompareTo({ status: 'open' }, 'previousPeriod', now);
      expect(out).toEqual({ status: 'open' });
    });
  });

  describe('previousYear', () => {
    it('re-resolves macros against now shifted back one year', () => {
      const filter = {
        d: { $gte: '{current_quarter_start}', $lte: '{current_quarter_end}' },
      };
      const out = shiftFilterByCompareTo(filter, 'previousYear', now);
      // Q2 2025 (2025-04-01 .. 2025-06-30)
      expect(out.d.$gte).toBe('2025-04-01');
      expect(out.d.$lte).toBe('2025-06-30');
    });
  });

  describe('offset', () => {
    it('shifts now by N days', () => {
      const out = shiftFilterByCompareTo({ d: '{today}' }, { offset: '7d' }, now);
      expect(out.d).toBe('2026-05-18');
    });
    it('shifts now by N weeks', () => {
      const out = shiftFilterByCompareTo({ d: '{today}' }, { offset: '2w' }, now);
      expect(out.d).toBe('2026-05-11');
    });
    it('shifts now by N months', () => {
      const out = shiftFilterByCompareTo({ d: '{today}' }, { offset: '1M' }, now);
      expect(out.d).toBe('2026-04-25');
    });
    it('shifts now by N years', () => {
      const out = shiftFilterByCompareTo({ d: '{today}' }, { offset: '1y' }, now);
      expect(out.d).toBe('2025-05-25');
    });
    it('falls back to current now when offset is malformed', () => {
      const out = shiftFilterByCompareTo({ d: '{today}' }, { offset: 'garbage' }, now);
      expect(out.d).toBe('2026-05-25');
    });
  });
});

describe('compareToTrendLabelKey', () => {
  it('previousYear → vsLastYear regardless of filter', () => {
    expect(compareToTrendLabelKey('previousYear', undefined)).toBe('vsLastYear');
    expect(compareToTrendLabelKey('previousYear', { d: '{today}' })).toBe('vsLastYear');
  });

  it('offset → vsPreviousPeriod', () => {
    expect(compareToTrendLabelKey({ offset: '7d' }, undefined)).toBe('vsPreviousPeriod');
  });

  describe('previousPeriod token sniffing', () => {
    it('detects year', () => {
      expect(compareToTrendLabelKey('previousPeriod', { d: '{current_year_start}' })).toBe('vsLastYear');
      expect(compareToTrendLabelKey('previousPeriod', { d: '{year_start}' })).toBe('vsLastYear');
    });
    it('detects quarter', () => {
      expect(compareToTrendLabelKey('previousPeriod', { d: '{current_quarter_end}' })).toBe('vsLastQuarter');
    });
    it('detects month', () => {
      expect(compareToTrendLabelKey('previousPeriod', { d: '{month_start}' })).toBe('vsLastMonth');
    });
    it('detects week', () => {
      expect(compareToTrendLabelKey('previousPeriod', { d: '{current_week_start}' })).toBe('vsLastWeek');
    });
    it('detects today', () => {
      expect(compareToTrendLabelKey('previousPeriod', { d: '{today}' })).toBe('vsYesterday');
    });
    it('falls back to vsPreviousPeriod when no token matches', () => {
      expect(compareToTrendLabelKey('previousPeriod', { status: 'open' })).toBe('vsPreviousPeriod');
      expect(compareToTrendLabelKey('previousPeriod', undefined)).toBe('vsPreviousPeriod');
    });
  });
});

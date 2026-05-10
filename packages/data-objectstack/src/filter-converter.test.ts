import { describe, it, expect } from 'vitest';
import { convertFilterToCubeFilters } from './index.js';

describe('convertFilterToCubeFilters', () => {
  it('returns [] for nullish', () => {
    expect(convertFilterToCubeFilters(null)).toEqual([]);
    expect(convertFilterToCubeFilters(undefined)).toEqual([]);
    expect(convertFilterToCubeFilters({})).toEqual([]);
  });

  it('coerces booleans to "1"/"0" so SQLite numeric columns match', () => {
    expect(convertFilterToCubeFilters({ is_active: true })).toEqual([
      { member: 'is_active', operator: 'equals', values: ['1'] },
    ]);
    expect(convertFilterToCubeFilters({ is_active: false })).toEqual([
      { member: 'is_active', operator: 'equals', values: ['0'] },
    ]);
  });

  it('handles short-form equality for strings', () => {
    expect(convertFilterToCubeFilters({ stage: 'closed_won' })).toEqual([
      { member: 'stage', operator: 'equals', values: ['closed_won'] },
    ]);
  });

  it('handles MongoDB operator wrappers', () => {
    expect(convertFilterToCubeFilters({ amount: { $gte: 100 } })).toEqual([
      { member: 'amount', operator: 'gte', values: ['100'] },
    ]);
    expect(
      convertFilterToCubeFilters({ stage: { $nin: ['lost', 'cancelled'] } }),
    ).toEqual([
      { member: 'stage', operator: 'notIn', values: ['lost', 'cancelled'] },
    ]);
  });

  it('handles SDUI {field, operator, value} shape', () => {
    expect(
      convertFilterToCubeFilters({ field: 'is_converted', operator: 'equals', value: false }),
    ).toEqual([
      { member: 'is_converted', operator: 'equals', values: ['0'] },
    ]);
  });

  it('handles array of {field, operator, value}', () => {
    expect(
      convertFilterToCubeFilters([
        { field: 'stage', operator: 'equals', value: 'won' },
        { field: 'amount', operator: 'gte', value: 1000 },
      ]),
    ).toEqual([
      { member: 'stage', operator: 'equals', values: ['won'] },
      { member: 'amount', operator: 'gte', values: ['1000'] },
    ]);
  });

  it('drops unknown operators rather than throwing', () => {
    expect(convertFilterToCubeFilters({ amount: { $weirdOp: 5 } })).toEqual([]);
  });

  it('handles mixed short-form + operator form', () => {
    const out = convertFilterToCubeFilters({
      stage: 'won',
      close_date: { $gte: '2024-01-01' },
    });
    expect(out).toEqual([
      { member: 'stage', operator: 'equals', values: ['won'] },
      { member: 'close_date', operator: 'gte', values: ['2024-01-01'] },
    ]);
  });
});

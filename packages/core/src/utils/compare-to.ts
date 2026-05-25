/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolveDateMacros } from './date-macros.js';

/**
 * Period-over-period comparison config for dashboard widgets.
 *
 * - `'previousPeriod'` — substitute `current_*` / `today` date macro tokens
 *   with their `last_*` / `yesterday` counterparts (e.g. `current_quarter_start`
 *   → `last_quarter_start`). Best when the filter uses date macros.
 * - `'previousYear'` — re-resolve date macros against a `now` shifted back
 *   one calendar year (same week / month / quarter, one year earlier).
 * - `{ offset: '7d' | '4w' | '1M' | '1y' }` — re-resolve macros against a
 *   `now` shifted by the given duration. Units: `d` (day), `w` (week),
 *   `M` (month), `y` (year).
 */
export type CompareToConfig =
  | 'previousPeriod'
  | 'previousYear'
  | { offset: string };

const CURRENT_TO_LAST_TOKENS: Record<string, string> = {
  current_week_start: 'last_week_start',
  current_week_end: 'last_week_end',
  current_month_start: 'last_month_start',
  current_month_end: 'last_month_end',
  current_quarter_start: 'last_quarter_start',
  current_quarter_end: 'last_quarter_end',
  current_year_start: 'last_year_start',
  current_year_end: 'last_year_end',
  week_start: 'last_week_start',
  week_end: 'last_week_end',
  month_start: 'last_month_start',
  month_end: 'last_month_end',
  quarter_start: 'last_quarter_start',
  quarter_end: 'last_quarter_end',
  year_start: 'last_year_start',
  year_end: 'last_year_end',
  today: 'yesterday',
};

function substituteTokens<T>(value: T, map: Record<string, string>): T {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.replace(/\$?\{([a-zA-Z0-9_]+)\}/g, (m, tok) => {
      const target = map[tok];
      return target ? `{${target}}` : m;
    }) as any;
  }
  if (Array.isArray(value)) return value.map((v) => substituteTokens(v, map)) as any;
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value as any)) out[k] = substituteTokens((value as any)[k], map);
    return out as any;
  }
  return value;
}

function shiftNow(now: Date, offset: string): Date | null {
  const m = offset.match(/^(\d+)([dwMy])$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const x = new Date(now);
  if (unit === 'd') x.setDate(x.getDate() - n);
  else if (unit === 'w') x.setDate(x.getDate() - n * 7);
  else if (unit === 'M') x.setMonth(x.getMonth() - n);
  else if (unit === 'y') x.setFullYear(x.getFullYear() - n);
  else return null;
  return x;
}

/**
 * Resolve a filter for a period-over-period comparison query.
 *
 * - `previousYear` — re-resolve date macros against a `now` shifted back by one year.
 * - `{ offset }` — re-resolve date macros against a `now` shifted by the given duration.
 * - `previousPeriod` — substitute `current_*` / `today` tokens with `last_*` / `yesterday`
 *   before resolving.
 */
export function shiftFilterByCompareTo<T = any>(
  filter: T,
  compareTo: CompareToConfig,
  now: Date = new Date(),
): T {
  if (compareTo === 'previousYear') {
    const shifted = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );
    return resolveDateMacros(filter, shifted);
  }
  if (typeof compareTo === 'object' && compareTo && 'offset' in compareTo) {
    const shifted = shiftNow(now, compareTo.offset);
    if (!shifted) return resolveDateMacros(filter, now);
    return resolveDateMacros(filter, shifted);
  }
  // previousPeriod
  const substituted = substituteTokens(filter, CURRENT_TO_LAST_TOKENS);
  return resolveDateMacros(substituted, now);
}

/**
 * Derive a translation key suffix (under `dashboard.trend.*`) describing the
 * comparison window. Used by metric widgets to label the trend delta.
 */
export function compareToTrendLabelKey(
  compareTo: CompareToConfig,
  filter?: unknown,
): string {
  if (compareTo === 'previousYear') return 'vsLastYear';
  if (typeof compareTo === 'object' && compareTo && 'offset' in compareTo) {
    return 'vsPreviousPeriod';
  }
  // previousPeriod — sniff the dominant token in the filter
  const json = filter ? JSON.stringify(filter) : '';
  if (/current_year_|year_start|year_end/.test(json)) return 'vsLastYear';
  if (/current_quarter_|quarter_start|quarter_end/.test(json)) return 'vsLastQuarter';
  if (/current_month_|month_start|month_end/.test(json)) return 'vsLastMonth';
  if (/current_week_|week_start|week_end/.test(json)) return 'vsLastWeek';
  if (/\btoday\b/.test(json)) return 'vsYesterday';
  return 'vsPreviousPeriod';
}

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useObjectTranslation } from '@object-ui/react';

/**
 * Default English translations for ObjectTimeline. Mirrors the
 * createSafeTranslationHook pattern used by plugin-detail / plugin-list so
 * the timeline keeps working when rendered standalone (Storybook, tests,
 * embed) without an I18nProvider on the React tree.
 */
export const TIMELINE_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'timeline.bucket.overdue': 'Overdue',
  'timeline.bucket.today': 'Today',
  'timeline.bucket.tomorrow': 'Tomorrow',
  'timeline.bucket.thisWeek': 'This week',
  'timeline.bucket.nextWeek': 'Next week',
  'timeline.bucket.later': 'Later',
  'timeline.bucket.noDate': 'No date',
  'timeline.bucket.unassigned': 'Unassigned',
  'timeline.relative.today': 'Today',
  'timeline.relative.tomorrow': 'Tomorrow',
  'timeline.relative.yesterday': 'Yesterday',
  'timeline.relative.inDays': 'In {{n}} days',
  'timeline.relative.daysAgo': '{{n}} days ago',
};

const TEST_KEY = 'timeline.bucket.today';

function fallback(key: string, options?: Record<string, unknown>): string {
  let v = TIMELINE_DEFAULT_TRANSLATIONS[key] || key;
  if (options) {
    for (const [k, val] of Object.entries(options)) {
      v = v.replace(`{{${k}}}`, String(val));
    }
  }
  return v;
}

export function useTimelineTranslation() {
  try {
    const result = useObjectTranslation();
    const testValue = result.t(TEST_KEY);
    if (testValue === TEST_KEY) {
      return { t: fallback };
    }
    return { t: result.t };
  } catch {
    return { t: fallback };
  }
}

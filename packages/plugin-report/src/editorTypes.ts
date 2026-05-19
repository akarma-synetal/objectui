/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Shared types and constants for the report editor sub-components.

export type AvailableField = {
  value: string;
  label: string;
  type?: string;
  options?: Array<{ value: string; label: string }>;
};

export type Translator = (key: string, defaultValue?: string, options?: any) => string;

export const DATE_TYPES = new Set(['date', 'datetime', 'time']);
export const NUMERIC_TYPES = new Set(['number', 'currency', 'percent', 'rating', 'integer']);
export const NONE = '' as const;

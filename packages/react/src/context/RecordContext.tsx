/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * RecordContext — shared record state for `record:*` namespace renderers
 * inside a `PageSchema` (type='record'). The page host (e.g. RecordDetailView)
 * mounts <RecordContextProvider> once; each `record:details / record:related_list
 * / record:highlights / record:activity / record:chatter / record:path` renderer
 * inside the page consumes data via `useRecordContext()` instead of having to
 * receive props from the schema tree.
 */

import React from 'react';

export interface RecordContextValue<TData = any, TObjectSchema = any> {
  /** Object machine name, e.g. "crm_opportunity". */
  objectName: string;
  /** Primary key value of the record being displayed. */
  recordId: string | number | null | undefined;
  /** Optional datasource id; mirrors the page-level datasource override. */
  dataSource?: string;
  /** Loaded record data (flat record map). Undefined while loading. */
  data?: TData;
  /** Resolved object metadata schema (fields, label, etc.). */
  objectSchema?: TObjectSchema;
  /** True while the record is fetching. */
  loading?: boolean;
  /** Last fetch error, if any. */
  error?: Error | null;
  /** Re-fetch the record from the source. */
  refresh?: () => void | Promise<void>;
}

const RecordContext = React.createContext<RecordContextValue | null>(null);

export interface RecordContextProviderProps extends RecordContextValue {
  children: React.ReactNode;
}

export const RecordContextProvider: React.FC<RecordContextProviderProps> = ({
  children,
  ...value
}) => {
  // Memoize so consumers that rely on referential equality don't re-render
  // on unrelated parent renders.
  const memo = React.useMemo<RecordContextValue>(() => value, [
    value.objectName,
    value.recordId,
    value.dataSource,
    value.data,
    value.objectSchema,
    value.loading,
    value.error,
    value.refresh,
  ]);
  return <RecordContext.Provider value={memo}>{children}</RecordContext.Provider>;
};

/**
 * Read the current record context. Returns `null` when called outside a
 * <RecordContextProvider> — record:* renderers should treat that as "no
 * record bound" rather than throwing, so they can still render statically
 * inside the Studio designer/palette.
 */
export function useRecordContext<TData = any, TObjectSchema = any>():
  RecordContextValue<TData, TObjectSchema> | null {
  return React.useContext(RecordContext) as RecordContextValue<TData, TObjectSchema> | null;
}

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:history` — renders an audit-log timeline for the current
 * record. Thin wrapper around `<HistoryTimeline>`.
 *
 * Data model: the schema carries `entries` (array of history rows)
 * and `loading` (boolean) directly. The owning page (typically
 * RecordDetailView's synthesizer path) is responsible for fetching
 * entries and passing them through. This keeps the renderer pure /
 * stateless and lets the host plug in different audit data sources.
 */

import React from 'react';
import { HistoryTimeline, type HistoryEntry } from '../HistoryTimeline';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordHistoryRendererProps {
  schema?: {
    entries?: HistoryEntry[];
    loading?: boolean;
    emptyText?: string;
    properties?: Record<string, any>;
    [k: string]: any;
  };
  className?: string;
  [k: string]: any;
}

export const RecordHistoryRenderer: React.FC<RecordHistoryRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const { designer } = splitDesigner(props);
  // Spec bridge inlines `properties.*` onto the node but also preserves
  // the raw bag. Read from either location for compatibility.
  const entries: HistoryEntry[] = Array.isArray(schema.entries)
    ? schema.entries
    : Array.isArray(schema.properties?.entries)
      ? (schema.properties!.entries as HistoryEntry[])
      : [];
  const loading = schema.loading ?? schema.properties?.loading ?? false;
  const emptyText = schema.emptyText ?? schema.properties?.emptyText;

  return (
    <div className={className} {...designer}>
      <HistoryTimeline entries={entries} loading={loading} emptyText={emptyText} />
    </div>
  );
};

export default RecordHistoryRenderer;

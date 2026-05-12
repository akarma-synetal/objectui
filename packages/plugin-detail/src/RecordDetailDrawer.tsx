/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * RecordDetailDrawer
 *
 * A standardized right-side drawer that renders {@link DetailView} for a
 * single record. Used by plugin-gantt, plugin-calendar and plugin-kanban
 * to provide a consistent "click row/event/card → side drawer with
 * inline edit + delete" UX without each plugin re-implementing the same
 * Sheet + typed-fields-from-objectSchema scaffolding.
 *
 * Field list is derived from the supplied objectSchema (so dates render
 * as date pickers, lookups stay readonly etc.). System/audit fields
 * (id, created_at, ...) are filtered out by default.
 */

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@object-ui/components';
import type { DataSource } from '@object-ui/types';
import { DetailView } from './DetailView';

const DEFAULT_SYSTEM_FIELDS = new Set([
  'id', '_id', '__v', 'created_at', 'updated_at', 'createdAt', 'updatedAt',
  'created_by', 'updated_by', 'organization_id', 'tenant_id', 'owner_id',
  'deleted_at', 'is_deleted',
]);

export interface RecordDetailDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the user dismisses the drawer (overlay click, Esc, after delete). */
  onClose: () => void;
  /** Drawer header title (typically the record's primary label). */
  title: string;
  /** The record being displayed. */
  record: Record<string, any>;
  /** Logical object name used by the data source. */
  objectName: string;
  /** Record id (string-coerced before issuing update/delete). */
  recordId: string | number;
  /** Active data source — used for inline updates and deletion. */
  dataSource?: DataSource;
  /**
   * Optional objectSchema (as returned by `dataSource.getObjectSchema`).
   * When provided the drawer infers field types so dates / picklists /
   * currency render with their proper widgets.
   */
  objectSchema?: { fields?: Record<string, any> } | null;
  /**
   * Drawer width — accepts any CSS width value. Defaults to
   * `min(960px, 60vw)` which fills ~60% of typical desktop viewports
   * (the prior `max-w-2xl` cap felt cramped on wide screens).
   */
  width?: string | number;
  /** Number of columns the field grid should use. Default `2`. */
  columns?: number;
  /**
   * Optional override for the SYSTEM_FIELDS filter. Defaults to a
   * standard set (id, timestamps, audit fields).
   */
  systemFields?: Set<string>;
  /**
   * Persist an inline field edit. Plugins usually update local state
   * here so the drawer stays in sync after the network round-trip.
   */
  onFieldSave?: (field: string, value: unknown) => void | Promise<void>;
  /**
   * Persist record deletion. Plugins are expected to remove the record
   * from their local state; the drawer auto-closes after this resolves.
   */
  onDelete?: () => void | Promise<void>;
}

/** Right-side drawer wrapping {@link DetailView} for a single record. */
export function RecordDetailDrawer({
  open,
  onClose,
  title,
  record,
  objectName,
  recordId,
  dataSource,
  objectSchema,
  width = 'min(960px, 60vw)',
  columns = 2,
  systemFields = DEFAULT_SYSTEM_FIELDS,
  onFieldSave,
  onDelete,
}: RecordDetailDrawerProps) {
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const widthStyle = widthValue
    ? { width: widthValue, maxWidth: widthValue }
    : undefined;

  // Build typed fields list from objectSchema, falling back to record keys
  // when no schema is available. Lookups are marked readonly because we
  // don't yet wire a relation picker inside the drawer's inline editor —
  // showing them as plain text inputs would let users overwrite the
  // relation with a free-form string.
  const schemaFields: Record<string, any> = (objectSchema?.fields ?? {}) as Record<string, any>;
  const orderedNames = Object.keys(schemaFields).length
    ? Object.keys(schemaFields)
    : Object.keys(record);
  const fields = orderedNames
    .filter((name) => !systemFields.has(name) && !name.startsWith('__'))
    .filter((name) => name in record)
    .map((name) => {
      const def = schemaFields[name] || {};
      const isLookup =
        def.type === 'lookup' ||
        def.type === 'master_detail' ||
        def.type === 'reference';
      return {
        name,
        label: def.label,
        type: def.type as any,
        readonly: !!def.readonly || isLookup,
      };
    });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:!max-w-none"
        style={widthStyle}
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <DetailView
            dataSource={dataSource}
            inlineEdit
            schema={{
              type: 'detail-view',
              objectName,
              resourceId: String(recordId),
              data: record,
              showDelete: true,
              columns,
              fields,
            } as any}
            onFieldSave={async (field, value) => {
              try {
                await onFieldSave?.(field, value);
              } catch (err) {
                console.error('[RecordDetailDrawer] inline field save failed:', err);
              }
            }}
            onDelete={async () => {
              try {
                await onDelete?.();
                onClose();
              } catch (err) {
                console.error('[RecordDetailDrawer] delete failed:', err);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default RecordDetailDrawer;

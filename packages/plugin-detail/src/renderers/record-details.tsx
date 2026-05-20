/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:details` — page-level record component that renders the canonical
 * field-detail block. Reads the bound record from <RecordContextProvider> and
 * synthesizes a DetailViewSchema for the existing DetailView component.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import { useFieldPermissions, usePermissions } from '@object-ui/permissions';
import type { RecordDetailsComponentProps } from '@object-ui/types';
import { DetailView } from '../DetailView';

/** Normalize a field entry (string | {field} | {name}) to its machine name. */
const fieldName = (entry: any): string | null => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') return entry.field || entry.name || null;
  return null;
};

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordDetailsRendererProps {
  schema?: RecordDetailsComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordDetailsRenderer: React.FC<RecordDetailsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);

  // Studio designer / palette: render an empty shell when no record bound.
  if (!ctx) {
    return (
      <div
        className={className}
        data-record-details-placeholder
        {...designer}
      >
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:details — bind a record to preview
        </div>
      </div>
    );
  }

  const layout: 'vertical' | 'horizontal' =
    schema.layout === 'inline' || schema.layout === 'compact' ? 'horizontal' : 'vertical';

  const objectName = ctx.objectName || '';
  const perms = usePermissions();
  const { readableFields } = useFieldPermissions(objectName);

  const required: string[] = Array.isArray((schema as any).requiredPermissions)
    ? (schema as any).requiredPermissions
    : [];
  if (required.length > 0 && objectName) {
    const ok = required.every((p) => perms.can(objectName, p as any));
    if (!ok) {
      return (
        <div className={className} {...designer} role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground italic">
            Insufficient permissions to view details.
          </p>
        </div>
      );
    }
  }

  const enforceFLS = (schema as any).enforceFieldSecurity === true;
  const redact: string[] = Array.isArray((schema as any).redactFields)
    ? (schema as any).redactFields
    : [];
  const filterList = (list: any[] | undefined): any[] | undefined => {
    if (!list) return list;
    if (!enforceFLS && redact.length === 0) return list;
    const names = list.map(fieldName).filter((n): n is string => !!n);
    const allowed = new Set(
      (enforceFLS && objectName ? readableFields(names) : names)
        .filter((n) => !redact.includes(n)),
    );
    return list.filter((e) => {
      const n = fieldName(e);
      return n ? allowed.has(n) : true;
    });
  };

  // Normalise field entries to the DetailViewField shape that DetailSection
  // expects. Schemas authored against `@objectstack/spec` declare fields as
  // bare strings (`fields: ['first_name', ...]`), but DetailSection reads
  // `field.name` / `field.label`, so we must coerce string → object form
  // before handing the schema to DetailView. Object entries pass through.
  const normaliseField = (entry: any): any => {
    if (typeof entry === 'string') return { name: entry };
    if (entry && typeof entry === 'object' && !entry.name && entry.field) {
      return { ...entry, name: entry.field };
    }
    return entry;
  };
  const normaliseList = (list: any[] | undefined): any[] | undefined =>
    Array.isArray(list) ? list.map(normaliseField) : list;

  const filteredFields = normaliseList(filterList(schema.fields as any[]));
  const filteredSections = Array.isArray(schema.sections)
    ? (schema.sections as any[]).map((s) => ({
        ...s,
        title: s.title ?? s.label,
        fields: normaliseList(filterList(s.fields)),
      }))
    : schema.sections;

  const synthesized: any = {
    type: 'detail-view',
    objectName: ctx.objectName,
    resourceId: ctx.recordId as any,
    data: ctx.data,
    layout,
    columns: schema.columns,
    sections: filteredSections,
    fields: filteredFields,
    showBack: false,
    // Suppress DetailView's own Airtable-style header chip. When
    // record:details is composed under a Lightning page:header the inner
    // title/star/copy chip would duplicate the surrounding page header.
    showHeader: schema.showHeader ?? false,
  };

  return (
    <div className={className} {...designer}>
      <DetailView schema={synthesized} dataSource={ctx.dataSource as any} />
    </div>
  );
};

export default RecordDetailsRenderer;

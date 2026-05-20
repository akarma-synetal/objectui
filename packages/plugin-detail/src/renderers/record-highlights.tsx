/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:highlights` — top-of-page key fact strip (Salesforce-style
 * Highlights Panel). Adapts the spec's `fields: string[]` to the legacy
 * HeaderHighlight component which expects `HighlightField[]`.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import { useFieldPermissions, usePermissions } from '@object-ui/permissions';
import type { RecordHighlightsComponentProps } from '@object-ui/types';
import { HeaderHighlight } from '../HeaderHighlight';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordHighlightsRendererProps {
  schema?: RecordHighlightsComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordHighlightsRenderer: React.FC<RecordHighlightsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);
  const objectName = ctx?.objectName || '';
  const perms = usePermissions();
  const { readableFields } = useFieldPermissions(objectName);

  // Object-level permission gate (record:* may declare requiredPermissions
  // like ['read','update'] which all must pass on the active object).
  const required: string[] = Array.isArray((schema as any).requiredPermissions)
    ? (schema as any).requiredPermissions
    : [];
  if (required.length > 0 && objectName) {
    const ok = required.every((p) => perms.can(objectName, p as any));
    if (!ok) {
      return (
        <div
          className={className}
          {...designer}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-muted-foreground italic">
            Insufficient permissions to view highlights.
          </p>
        </div>
      );
    }
  }

  const names: string[] = Array.isArray(schema.fields) ? schema.fields : [];
  const enforceFLS = (schema as any).enforceFieldSecurity === true;
  const redact: string[] = Array.isArray((schema as any).redactFields)
    ? (schema as any).redactFields
    : [];
  const visibleNames = enforceFLS && objectName
    ? readableFields(names).filter((n) => !redact.includes(n))
    : names.filter((n) => !redact.includes(n));
  const highlightFields = visibleNames.map((name) => ({ name }));

  return (
    <div className={className} {...designer}>
      <HeaderHighlight
        fields={highlightFields as any}
        data={ctx?.data}
        objectName={ctx?.objectName}
        objectSchema={ctx?.objectSchema as any}
      />
    </div>
  );
};

export default RecordHighlightsRenderer;

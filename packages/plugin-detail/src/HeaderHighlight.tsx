/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardContent } from '@object-ui/components';
import type { HighlightField } from '@object-ui/types';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { useSafeFieldLabel } from '@object-ui/react';

export interface HeaderHighlightProps {
  fields: HighlightField[];
  data?: any;
  className?: string;
  /** Object name for i18n field label resolution */
  objectName?: string;
  /** Object schema for field metadata enrichment */
  objectSchema?: any;
}

export const HeaderHighlight: React.FC<HeaderHighlightProps> = ({
  fields,
  data,
  className,
  objectName,
  objectSchema,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  if (!fields.length || !data) return null;

  // Filter to only fields with values
  const visibleFields = fields.filter((f) => {
    const val = data?.[f.name];
    return val !== null && val !== undefined && val !== '';
  });

  if (visibleFields.length === 0) return null;

  return (
    <Card className={cn('bg-muted/40 border-border/40 shadow-none', className)}>
      <CardContent className="@container py-3 px-4">
        <div
          className={cn(
            // Phase N.3: pack cells from the left with a sane max-width per
            // cell so sparse highlight strips (1-2 fields) don't stretch
            // each cell across the entire page. Stay grid-shaped at small
            // counts for visual rhythm; switch to wrap-flex for 4+.
            'flex flex-wrap gap-x-8 gap-y-3',
          )}
        >
          {visibleFields.map((field) => {
            const value = data[field.name];
            // Enrich field metadata from objectSchema
            const objectDefField = objectSchema?.fields?.[field.name];
            const resolvedType = field.type || objectDefField?.type;
            const enrichedField = {
              name: field.name,
              label: field.label,
              type: resolvedType || 'text',
              ...(objectDefField?.options && { options: objectDefField.options }),
              ...(objectDefField?.currency && { currency: objectDefField.currency }),
              ...(objectDefField?.precision !== undefined && { precision: objectDefField.precision }),
              ...(objectDefField?.format && { format: objectDefField.format }),
            };

            // Use type-aware cell renderer — all renderers coerce values via
            // coerceToSafeValue() so even object/array data is safe (no error #310).
            const CellRenderer = getCellRenderer(
              resolveCellRendererType(enrichedField as any) || resolvedType || 'text',
            );

            return (
              <div
                key={field.name}
                className="flex min-w-[8rem] max-w-[16rem] basis-[10rem] flex-col gap-0.5"
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {field.icon && <span className="mr-1">{field.icon}</span>}
                  {fieldLabel(objectName || '', field.name, field.label)}
                </span>
                <span className="block min-w-0 truncate text-sm font-semibold">
                  <CellRenderer value={value} field={enrichedField as any} />
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

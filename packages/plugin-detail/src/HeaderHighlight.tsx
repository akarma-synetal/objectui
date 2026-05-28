/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn } from '@object-ui/components';
import type { HighlightField } from '@object-ui/types';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { useSafeFieldLabel } from '@object-ui/react';
import { Check, X } from 'lucide-react';

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
    <section
      className={cn(
        // De-boxed: render as a naked stats row with subtle bottom divider
        // instead of a filled Card. Keeps the page calm and lets the tab
        // strip below carry the visual anchor.
        '@container border-b border-border/60 pb-4',
        className,
      )}
      aria-label="Record highlights"
    >
      <div className={cn('flex flex-wrap gap-x-8 gap-y-3')}>
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

          // Treat numeric / currency / percent / count as KPI values —
          // render larger, tabular-nums for nice column alignment.
          const isKpi =
            resolvedType === 'number' ||
            resolvedType === 'integer' ||
            resolvedType === 'currency' ||
            resolvedType === 'percent' ||
            resolvedType === 'decimal';

          // Booleans get their own pill rendering — the default
          // BooleanCellRenderer paints a tiny disabled checkbox which
          // reads as "empty input" in the header context. Pills with
          // ✓ / ✗ icons match how every modern enterprise UI
          // (Salesforce, Linear, Notion) surfaces status booleans.
          const isBoolean = resolvedType === 'boolean';

          return (
            <div
              key={field.name}
              className="flex min-w-[8rem] max-w-[16rem] basis-[10rem] flex-col gap-1"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {fieldLabel(objectName || '', field.name, field.label)}
              </span>
              {isBoolean ? (
                value ? (
                  <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden />
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 self-start rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400">
                    <X className="h-3 w-3" aria-hidden />
                    No
                  </span>
                )
              ) : (
                <span
                  className={cn(
                    'block min-w-0 truncate',
                    isKpi
                      ? 'text-xl md:text-2xl font-semibold leading-tight tabular-nums tracking-tight'
                      : 'text-sm font-semibold',
                  )}
                >
                  <CellRenderer value={value} field={enrichedField as any} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

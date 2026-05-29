// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardWidgetInspector — scoped property panel for the widget
 * selected inside <DashboardPreview>.
 *
 * Renders the per-widget form (title / type / data source / KPI value
 * / aggregate / color / layout size) for the widget identified by
 * `selection.id`. Patches are written back into `draft.widgets[i]`
 * (immutably) and emitted via `onPatch`, so live preview updates
 * instantly on the left side.
 *
 * The shape mirrors the WidgetPropertyPanel that ships in
 * @object-ui/plugin-designer's DashboardEditor — same fields, same
 * defaults, same enums — so users familiar with the standalone
 * designer feel at home here.
 */

import * as React from 'react';
import { X } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import type { DashboardWidgetSchema } from '@object-ui/types';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';

const WIDGET_TYPES = [
  { value: 'metric', label: 'KPI Metric' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'table', label: 'Table' },
  { value: 'grid', label: 'Grid' },
];

const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'];

const COLORS = [
  'default',
  'blue',
  'teal',
  'orange',
  'purple',
  'success',
  'warning',
  'danger',
];

function findWidget(
  draft: Record<string, unknown>,
  id: string,
): { widget: DashboardWidgetSchema; index: number } | null {
  const widgets = Array.isArray((draft as any).widgets)
    ? ((draft as any).widgets as DashboardWidgetSchema[])
    : [];
  const index = widgets.findIndex((w) => w?.id === id);
  if (index < 0) return null;
  return { widget: widgets[index], index };
}

export function DashboardWidgetInspector({
  draft,
  selection,
  onPatch,
  onClearSelection,
  readOnly,
  locale,
}: MetadataInspectorProps) {
  if (selection.kind !== 'widget') {
    return (
      <InspectorEmpty
        message={`Unsupported selection kind: ${selection.kind}`}
        onClose={onClearSelection}
        locale={locale}
      />
    );
  }

  const hit = findWidget(draft, selection.id);
  if (!hit) {
    return (
      <InspectorEmpty
        message="The selected widget was removed from the draft."
        onClose={onClearSelection}
        locale={locale}
      />
    );
  }

  const { widget, index } = hit;

  function patchWidget(updates: Partial<DashboardWidgetSchema>) {
    const widgets = Array.isArray((draft as any).widgets)
      ? ([...(draft as any).widgets] as DashboardWidgetSchema[])
      : [];
    widgets[index] = { ...widgets[index], ...updates };
    onPatch({ widgets });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('engine.inspector.widget.kind', locale)}
          </div>
          <div className="truncate text-sm font-semibold">
            {widget.title || selection.label || `Widget ${index + 1}`}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={onClearSelection}
          title={t('engine.inspector.widget.close', locale)}
          aria-label={t('engine.inspector.widget.close', locale)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Field id="widget-title" label={t('engine.inspector.widget.title', locale)}>
        <Input
          id="widget-title"
          value={widget.title ?? ''}
          onChange={(e) => patchWidget({ title: e.target.value })}
          disabled={readOnly}
        />
      </Field>

      <Field id="widget-type" label={t('engine.inspector.widget.type', locale)}>
        <Select
          value={widget.type ?? 'metric'}
          onValueChange={(v) => patchWidget({ type: v })}
          disabled={readOnly}
        >
          <SelectTrigger id="widget-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_TYPES.map((wt) => (
              <SelectItem key={wt.value} value={wt.value}>
                {wt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="widget-object" label={t('engine.inspector.widget.object', locale)}>
        <Input
          id="widget-object"
          value={widget.object ?? ''}
          placeholder="e.g. order"
          onChange={(e) => patchWidget({ object: e.target.value })}
          disabled={readOnly}
        />
      </Field>

      <Field id="widget-value-field" label={t('engine.inspector.widget.valueField', locale)}>
        <Input
          id="widget-value-field"
          value={widget.valueField ?? ''}
          placeholder="e.g. amount"
          onChange={(e) => patchWidget({ valueField: e.target.value })}
          disabled={readOnly}
        />
      </Field>

      <Field id="widget-category-field" label={t('engine.inspector.widget.categoryField', locale)}>
        <Input
          id="widget-category-field"
          value={widget.categoryField ?? ''}
          placeholder="e.g. status"
          onChange={(e) => patchWidget({ categoryField: e.target.value })}
          disabled={readOnly}
        />
      </Field>

      <Field id="widget-aggregate" label={t('engine.inspector.widget.aggregate', locale)}>
        <Select
          value={widget.aggregate ?? 'count'}
          onValueChange={(v) => patchWidget({ aggregate: v })}
          disabled={readOnly}
        >
          <SelectTrigger id="widget-aggregate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATES.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="widget-color" label={t('engine.inspector.widget.color', locale)}>
        <Select
          value={widget.colorVariant ?? 'default'}
          onValueChange={(v) =>
            patchWidget({
              colorVariant: v as DashboardWidgetSchema['colorVariant'],
            })
          }
          disabled={readOnly}
        >
          <SelectTrigger id="widget-color">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLORS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="widget-w" label={t('engine.inspector.widget.width', locale)}>
          <Input
            id="widget-w"
            type="number"
            min={1}
            value={widget.layout?.w ?? 1}
            onChange={(e) =>
              patchWidget({
                layout: {
                  ...(widget.layout ?? {}),
                  w: Number(e.target.value) || 1,
                } as DashboardWidgetSchema['layout'],
              })
            }
            disabled={readOnly}
          />
        </Field>
        <Field id="widget-h" label={t('engine.inspector.widget.height', locale)}>
          <Input
            id="widget-h"
            type="number"
            min={1}
            value={widget.layout?.h ?? 1}
            onChange={(e) =>
              patchWidget({
                layout: {
                  ...(widget.layout ?? {}),
                  h: Number(e.target.value) || 1,
                } as DashboardWidgetSchema['layout'],
              })
            }
            disabled={readOnly}
          />
        </Field>
      </div>

      {!readOnly && (
        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              const widgets = Array.isArray((draft as any).widgets)
                ? ([...(draft as any).widgets] as DashboardWidgetSchema[])
                : [];
              widgets.splice(index, 1);
              onPatch({ widgets });
              onClearSelection();
            }}
          >
            {t('engine.inspector.widget.remove', locale)}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function InspectorEmpty({
  message,
  onClose,
  locale,
}: {
  message: string;
  onClose: () => void;
  locale: MetadataInspectorProps['locale'];
}) {
  return (
    <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <p>{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        {t('engine.inspector.widget.close', locale)}
      </Button>
    </div>
  );
}

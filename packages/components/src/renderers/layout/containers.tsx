/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Spec-aligned container renderers for the `page:*` component namespace.
 * Backs the Page-as-root record detail page model (Salesforce Lightning
 * Record Page parity).
 *
 * Maps `packages/spec/src/ui/component.zod.ts` props:
 *   - PageTabsProps      -> page:tabs
 *   - PageCardProps      -> page:card
 *   - PageAccordionProps -> page:accordion
 *   - PageHeaderProps    -> page:header
 *   - page:footer / page:sidebar / page:section thin wrappers
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useRecordContext } from '@object-ui/react';
import { renderChildren, cn } from '../../lib/utils';
import { LazyIcon } from '../../lib/lazy-icon';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Separator,
} from '../../ui';

/**
 * Pull the standard designer-passthrough props off a renderer's `props`.
 * Every page:* renderer must forward these so the Studio designer overlay
 * can still target the rendered element.
 */
const splitDesignerProps = (props: Record<string, any>) => {
  const {
    'data-obj-id': dataObjId,
    'data-obj-type': dataObjType,
    style,
    ...rest
  } = props || {};
  return {
    designer: { 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style },
    rest,
  };
};

/** Pick a value for I18nLabelSchema (string or { default, ... } shape). */
const labelText = (label: any): string => {
  if (label == null) return '';
  if (typeof label === 'string') return label;
  if (typeof label === 'object') return label.default || label.value || '';
  return String(label);
};

/**
 * Replace `{field.path}` tokens in a template against the given data object.
 * Missing fields collapse to an empty string. The result is trimmed and
 * whitespace-collapsed so partial misses don't leave gaping holes.
 */
const interpolate = (template: string, data: any): string => {
  if (!template || typeof template !== 'string') return template || '';
  if (!template.includes('{')) return template;
  const out = template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, path: string) => {
    const v = path.split('.').reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), data);
    return v == null ? '' : String(v);
  });
  return out.replace(/\s+/g, ' ').trim();
};

// ---------------------------------------------------------------------------
// page:tabs
// ---------------------------------------------------------------------------

interface PageTabsItem {
  label: any;
  icon?: string;
  /**
   * Optional badge value rendered after the label (e.g. related-list count).
   * Numbers >= 1000 are shortened to `1.2k`-style.
   */
  count?: number | string;
  children: any[];
}

const formatTabCount = (v: number | string): string => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
};

/**
 * Walk a tab's children (depth-first) and return the first
 * `record:related_list` schema node found. Used to auto-derive a count
 * for the tab badge when the spec author didn't supply one explicitly.
 */
/**
 * Walk a tab's children (depth-first) and collect every `record:related_list`
 * schema node. Used to auto-derive a count for the tab badge when the spec
 * author didn't supply one explicitly. Multiple lists are summed (Salesforce
 * "Related" tab convention).
 */
const collectRelatedLists = (nodes: any, acc: any[] = []): any[] => {
  if (!nodes) return acc;
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const n of list) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'record:related_list' || n.type === 'record_related_list') {
      acc.push(n);
      continue; // Don't descend into a related_list's own subtree.
    }
    const candidates = [
      n.children,
      n.properties?.children,
      n.properties?.items,
      n.body,
      n.items,
    ];
    for (const c of candidates) {
      if (c) collectRelatedLists(c, acc);
    }
  }
  return acc;
};

const PageTabsRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const items: PageTabsItem[] = schema?.items || [];
  // Tab visual style lives at `properties.type` ('line'|'card'|'pill') — the
  // outer `schema.type` is always 'page:tabs' (the component dispatch key).
  const type: 'line' | 'card' | 'pill' = schema?.properties?.type || schema?.tabStyle || 'line';
  const position: 'top' | 'left' = schema?.position || 'top';
  const isVertical = position === 'left';

  // Auto-derive tab counts from any `record:related_list` descendant of
  // each tab. The fetch is a `limit:1` find so we only consume the `total`
  // — cheap relative to the eventual list render the user gets when they
  // open the tab. Spec authors that pass `count` explicitly win.
  const ctx = useRecordContext();
  const parentId = ctx?.data?.id;
  const ds: any = ctx?.dataSource;
  const [derivedCounts, setDerivedCounts] = React.useState<Record<number, number>>({});

  // Snapshot which tabs (index → derived (objectName, relationshipField))
  // need a count probe. Cached per items reference so we don't re-walk on
  // every render.
  const probeTargets = React.useMemo(() => {
    // Map tab index → array of probes (one per related_list inside the tab).
    // The badge sums per-probe totals so a "Related" tab containing an
    // accordion of multiple related lists still shows a meaningful number.
    const out = new Map<number, Array<{ objectName: string; relationshipField?: string }>>();
    items.forEach((it, idx) => {
      if (it.count !== undefined && it.count !== null && it.count !== '') return;
      const lists = collectRelatedLists((it as any).children);
      const probes: Array<{ objectName: string; relationshipField?: string }> = [];
      for (const rl of lists) {
        const objectName: string | undefined = rl?.properties?.objectName || rl?.objectName;
        if (!objectName) continue;
        const relationshipField: string | undefined =
          rl?.properties?.relationshipField || rl?.relationshipField;
        probes.push({ objectName, relationshipField });
      }
      if (probes.length > 0) out.set(idx, probes);
    });
    return out;
  }, [items]);

  React.useEffect(() => {
    if (!ds || typeof ds.find !== 'function') return;
    if (probeTargets.size === 0) return;
    let cancelled = false;
    for (const [idx, probes] of probeTargets) {
      Promise.all(
        probes.map((probe) => {
          const where: any = {};
          if (probe.relationshipField) {
            if (!parentId) return Promise.resolve(0);
            where[probe.relationshipField] = parentId;
          }
          return Promise.resolve(ds.find(probe.objectName, { where, limit: 1 }))
            .then((res: any) => {
              const total =
                typeof res?.total === 'number'
                  ? res.total
                  : Array.isArray(res?.data)
                    ? res.data.length
                    : Array.isArray(res)
                      ? res.length
                      : 0;
              return typeof total === 'number' ? total : 0;
            })
            .catch(() => 0);
        }),
      ).then((counts) => {
        if (cancelled) return;
        const sum = counts.reduce((a, b) => a + b, 0);
        setDerivedCounts((prev) => (prev[idx] === sum ? prev : { ...prev, [idx]: sum }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [ds, probeTargets, parentId]);

  // PageTabsProps doesn't carry a value, synthesize one from the index so
  // Radix Tabs (which requires stable values) is happy.
  const itemsWithValue = items.map((it, idx) => ({
    ...it,
    value: `tab-${idx}`,
    labelStr: labelText(it.label),
    // Explicit spec count wins; otherwise fall back to the derived probe.
    count: it.count !== undefined && it.count !== null && it.count !== ''
      ? it.count
      : derivedCounts[idx],
  }));

  const defaultValue = itemsWithValue[0]?.value;

  const listClass = cn(
    isVertical && 'flex-col h-auto items-stretch p-1',
    type === 'card' && 'bg-transparent gap-1',
    type === 'pill' && 'bg-muted rounded-full p-1 gap-1',
    // Pin the horizontal tab strip to the top of the scroll container so
    // users keep their bearings on long record pages. Skipped for vertical
    // layouts where the strip is a sidebar, not a header.
    !isVertical && 'sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  );

  const triggerClass = (active = false) => cn(
    isVertical && 'justify-start',
    type === 'card' && 'data-[state=active]:bg-background data-[state=active]:border data-[state=active]:shadow-sm rounded-md',
    type === 'pill' && 'rounded-full data-[state=active]:bg-background',
  );

  return (
    <Tabs
      defaultValue={defaultValue}
      orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cn(className, isVertical && 'flex gap-4 w-full')}
      {...designer}
    >
      <TabsList className={listClass}>
        {itemsWithValue.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className={triggerClass()}>
            {item.icon && (
              <LazyIcon
                name={item.icon}
                className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70"
                aria-hidden
              />
            )}
            <span>{item.labelStr}</span>
            {item.count !== undefined && item.count !== null && item.count !== '' && (
              <span
                className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium leading-none text-muted-foreground"
                aria-label={`${formatTabCount(item.count)} items`}
              >
                {formatTabCount(item.count)}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {itemsWithValue.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          className={cn('mt-3', isVertical && 'mt-0 flex-1')}
        >
          {renderChildren(item.children)}
        </TabsContent>
      ))}
    </Tabs>
  );
};

ComponentRegistry.register('page:tabs', PageTabsRenderer, {
  namespace: 'page',
  label: 'Page Tabs',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:card
// ---------------------------------------------------------------------------

const PageCardRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const title = labelText(schema?.title);
  const bordered = schema?.bordered !== false;
  const body = schema?.body;
  const footer = schema?.footer;

  return (
    <Card
      className={cn(className, !bordered && 'border-0 shadow-none bg-transparent')}
      {...designer}
    >
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      {body && <CardContent>{renderChildren(body)}</CardContent>}
      {footer && <CardFooter className="flex justify-between">{renderChildren(footer)}</CardFooter>}
    </Card>
  );
};

ComponentRegistry.register('page:card', PageCardRenderer, {
  namespace: 'page',
  label: 'Page Card',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:accordion
// ---------------------------------------------------------------------------

interface PageAccordionItem {
  label: any;
  icon?: string;
  collapsed?: boolean;
  children: any[];
}

const PageAccordionRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const items: PageAccordionItem[] = schema?.items || [];
  const allowMultiple = !!schema?.allowMultiple;

  const itemsWithValue = items.map((it, idx) => ({
    ...it,
    value: `panel-${idx}`,
    labelStr: labelText(it.label),
  }));

  const defaultOpen = itemsWithValue
    .filter((it) => it.collapsed === false)
    .map((it) => it.value);

  // Radix Accordion has separate single/multiple variants; render the right
  // one without trying to share a generic prop bag.
  const commonChildren = itemsWithValue.map((item) => (
    <AccordionItem key={item.value} value={item.value}>
      <AccordionTrigger>{item.labelStr}</AccordionTrigger>
      <AccordionContent>{renderChildren(item.children)}</AccordionContent>
    </AccordionItem>
  ));

  if (allowMultiple) {
    return (
      <Accordion
        type="multiple"
        defaultValue={defaultOpen}
        className={className}
        {...designer}
      >
        {commonChildren}
      </Accordion>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen[0]}
      className={className}
      {...designer}
    >
      {commonChildren}
    </Accordion>
  );
};

ComponentRegistry.register('page:accordion', PageAccordionRenderer, {
  namespace: 'page',
  label: 'Page Accordion',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:section — thin wrapper used inside regions for grouping children.
// ---------------------------------------------------------------------------

const PageSectionRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  return (
    <section
      className={cn('space-y-4', className)}
      {...designer}
    >
      {renderChildren(schema?.children || schema?.body)}
    </section>
  );
};

ComponentRegistry.register('page:section', PageSectionRenderer, {
  namespace: 'page',
  label: 'Page Section',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:header — title row + optional subtitle + breadcrumb/action slots.
// Action ids are intentionally not resolved here; that will land alongside
// the upcoming `record:quick_actions` renderer.
// ---------------------------------------------------------------------------

const PageHeaderRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const ctx = useRecordContext();
  // Spec bridge may either inline `properties.*` onto the node or preserve
  // the raw bag (see record:quick_actions for the same pattern). Read from
  // both so a `{ properties: { title } }` schema is rendered correctly.
  const titleSrc = schema?.title ?? schema?.properties?.title;
  const subtitleSrc = schema?.subtitle ?? schema?.properties?.subtitle;
  const title = interpolate(labelText(titleSrc), ctx?.data);
  const subtitle = interpolate(labelText(subtitleSrc), ctx?.data);
  const breadcrumb = (schema?.breadcrumb ?? schema?.properties?.breadcrumb) !== false;

  return (
    <header
      className={cn('flex flex-col gap-2 pb-4 border-b', className)}
      {...designer}
    >
      {breadcrumb && (
        <div className="text-xs text-muted-foreground" data-page-breadcrumb-slot />
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div data-page-actions-slot />
      </div>
    </header>
  );
};

ComponentRegistry.register('page:header', PageHeaderRenderer, {
  namespace: 'page',
  label: 'Page Header',
  category: 'layout',
});

// ---------------------------------------------------------------------------
// page:footer — thin <footer> wrapper.
// ---------------------------------------------------------------------------

const PageFooterRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  return (
    <>
      <Separator className="my-4" />
      <footer
        className={cn('flex items-center justify-between text-sm text-muted-foreground', className)}
        {...designer}
      >
        {renderChildren(schema?.children || schema?.body)}
      </footer>
    </>
  );
};

ComponentRegistry.register('page:footer', PageFooterRenderer, {
  namespace: 'page',
  label: 'Page Footer',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:sidebar — thin <aside> wrapper for region children.
// ---------------------------------------------------------------------------

const PageSidebarRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  return (
    <aside
      className={cn('flex flex-col gap-4 w-full md:w-80 shrink-0', className)}
      {...designer}
    >
      {renderChildren(schema?.children || schema?.body)}
    </aside>
  );
};

ComponentRegistry.register('page:sidebar', PageSidebarRenderer, {
  namespace: 'page',
  label: 'Page Sidebar',
  category: 'layout',
  isContainer: true,
});

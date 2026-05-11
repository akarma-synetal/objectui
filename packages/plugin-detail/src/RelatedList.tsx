/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Input,
  cn,
} from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import {
  Plus,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronDown,
  Inbox,
  icons as lucideIcons,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DataSource, FieldMetadata } from '@object-ui/types';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { useDetailTranslation } from './useDetailTranslation';
import { useSafeFieldLabel } from '@object-ui/react';

export interface RelatedListProps {
  title: string;
  type: 'list' | 'grid' | 'table';
  api?: string;
  data?: any[];
  schema?: any;
  columns?: any[];
  className?: string;
  dataSource?: DataSource;
  /** Object name for i18n field label resolution */
  objectName?: string;
  /** Callback when "New" button is clicked */
  onNew?: () => void;
  /** Callback when "View All" button is clicked */
  onViewAll?: () => void;
  /** Callback when a row Edit action is clicked */
  onRowEdit?: (row: any) => void;
  /** Callback when a row Delete action is clicked */
  onRowDelete?: (row: any) => void;
  /** Page size for pagination (enables pagination when set) */
  pageSize?: number;
  /** Enable column sorting */
  sortable?: boolean;
  /** Enable text filtering */
  filterable?: boolean;
  /** Whether the card is collapsible */
  collapsible?: boolean;
  /** Whether the card starts collapsed (requires collapsible=true) */
  defaultCollapsed?: boolean;
  /**
   * Foreign-key field name on child records pointing back to the parent.
   * The renderer hides this column from the table and from the schema-derived
   * column list, since the parent record is already implicit context.
   */
  referenceField?: string;
  /** Lucide icon name (kebab-case) to render next to the section title. */
  icon?: string;
}

/**
 * Resolve a kebab-case Lucide icon name (e.g. `"file-text"`) to the React
 * component. Returns the Inbox fallback when the name is missing or unknown.
 */
function resolveIconComponent(name: string | undefined): LucideIcon {
  if (!name) return Inbox;
  const pascal = name
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return ((lucideIcons as Record<string, LucideIcon>)[pascal]) || Inbox;
}

export const RelatedList: React.FC<RelatedListProps> = ({
  title,
  type,
  api,
  data = [],
  schema,
  columns,
  className,
  dataSource,
  objectName,
  onNew,
  onViewAll,
  onRowEdit,
  onRowDelete,
  pageSize,
  sortable = false,
  filterable = false,
  collapsible = false,
  defaultCollapsed = false,
  referenceField,
  icon,
}) => {
  const [relatedData, setRelatedData] = React.useState(data);
  const [loading, setLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [sortField, setSortField] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = React.useState('');
  const [objectSchema, setObjectSchema] = React.useState<any>(null);
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const { t } = useDetailTranslation();
  const { fieldLabel: resolveFieldLabel } = useSafeFieldLabel();

  // Sync internal state when data prop changes (e.g., parent fetches async data)
  React.useEffect(() => {
    setRelatedData(data);
  }, [data]);

  // Auto-fetch object schema when api/dataSource available but columns missing
  React.useEffect(() => {
    if (api && dataSource?.getObjectSchema && !columns?.length) {
      dataSource.getObjectSchema(api).then(setObjectSchema).catch((err: unknown) => {
        console.warn(`[RelatedList] Failed to fetch schema for ${api}:`, err);
      });
    }
  }, [api, dataSource, columns]);

  React.useEffect(() => {
    if (api && !data.length) {
      setLoading(true);
      if (dataSource && typeof dataSource.find === 'function') {
        dataSource.find(api).then((result) => {
          const items = Array.isArray(result)
            ? result
            : Array.isArray((result as any)?.data)
              ? (result as any).data
              : [];
          setRelatedData(items);
          setLoading(false);
        }).catch((err) => {
          console.error('Failed to fetch related data:', err);
          setLoading(false);
        });
      } else {
        fetch(api)
          .then(res => res.json())
          .then(result => {
            const items = Array.isArray(result) ? result : (result?.data || []);
            setRelatedData(items);
          })
          .catch(err => {
            console.error('Failed to fetch related data:', err);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [api, data, dataSource]);

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!filterText) return relatedData;
    const lower = filterText.toLowerCase();
    return relatedData.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      )
    );
  }, [relatedData, filterText]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortField, sortDirection]);

  // Paginate data
  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : 0;
  const totalPages = effectivePageSize ? Math.max(1, Math.ceil(sortedData.length / effectivePageSize)) : 1;
  const paginatedData = effectivePageSize
    ? sortedData.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize)
    : sortedData;

  // Reset to first page when filter/sort changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [filterText, sortField, sortDirection]);

  const handleSort = React.useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleDeleteRow = React.useCallback((row: any) => {
    if (window.confirm(t('detail.deleteRowConfirmation'))) {
      onRowDelete?.(row);
    }
  }, [onRowDelete, t]);

  // Generate effective columns from explicit prop or object schema fields,
  // hiding the parent foreign-key column when `referenceField` is provided.
  const effectiveColumns = React.useMemo(() => {
    const filterFK = (cols: any[]): any[] =>
      referenceField
        ? cols.filter((c) => {
            const key = c?.accessorKey || c?.field || c?.name;
            return key !== referenceField;
          })
        : cols;
    if (columns && columns.length > 0) return filterFK(columns);
    if (!objectSchema?.fields) return [];
    const resolvedObjectName = objectName || api || '';
    const generated = Object.entries(objectSchema.fields)
      .filter(([key, def]: [string, any]) => {
        if (key.startsWith('_')) return false;
        if (key === 'id' || key === referenceField) return false;
        if (def?.hidden) return false;
        return true;
      })
      .map(([key, def]: [string, any]) => {
        const col: any = {
          accessorKey: key,
          header: resolveFieldLabel(resolvedObjectName, key, def.label || key),
        };
        // Add type-aware cell renderer for typed fields
        if (def.type) {
          const rendererType = resolveCellRendererType({ type: def.type, format: def.format }) || def.type;
          const CellRenderer = getCellRenderer(rendererType);
          if (CellRenderer) {
            const fieldMeta: FieldMetadata = {
              name: key,
              label: def.label || key,
              type: def.type,
              ...(def.options && { options: def.options }),
              ...(def.currency && { currency: def.currency }),
              ...(def.precision !== undefined && { precision: def.precision }),
              ...(def.format && { format: def.format }),
              ...((def.reference_to || def.reference) && { reference_to: def.reference_to || def.reference }),
              ...(def.reference_field && { reference_field: def.reference_field }),
            };
            col.cell = (value: any) => {
              if (value === null || value === undefined) {
                return React.createElement('span', { className: 'text-muted-foreground/50 text-xs italic' }, '—');
              }
              return React.createElement(CellRenderer, { value, field: fieldMeta });
            };
          }
        }
        return col;
      });
    return generated;
  }, [columns, objectSchema, objectName, api, resolveFieldLabel, referenceField]);

  const hasRowActions = !!onRowEdit || !!onRowDelete;

  const viewSchema = React.useMemo(() => {
    if (schema) return schema;

    // Auto-generate schema based on type. We disable the data-table's own
    // search/toolbar — RelatedList provides its own filter input above.
    switch (type) {
      case 'grid':
      case 'table':
        return {
          type: 'data-table',
          data: paginatedData,
          columns: effectiveColumns,
          pagination: false, // We handle pagination ourselves
          pageSize: effectivePageSize || 10,
          searchable: false,
          exportable: false,
          rowActions: hasRowActions,
          onRowEdit,
          onRowDelete: onRowDelete ? handleDeleteRow : undefined,
        };
      case 'list':
        return {
          type: 'data-list',
          data: paginatedData,
        };
      default:
        return { type: 'div', children: 'No view configured' };
    }
  }, [type, paginatedData, effectiveColumns, schema, effectivePageSize, hasRowActions, onRowEdit, onRowDelete, handleDeleteRow]);

  const headerClassName = collapsible ? 'cursor-pointer select-none' : undefined;
  const handleHeaderClick = collapsible ? () => setCollapsed((c) => !c) : undefined;

  const SectionIcon = resolveIconComponent(icon);
  const isEmpty = !loading && relatedData.length === 0;
  // When the consumer explicitly enables `filterable`, always render the
  // filter input — they're opting in. (data-table's own auto-search is
  // suppressed via the viewSchema below to avoid a duplicate input.)
  const showFilterInput = filterable;

  return (
    <Card className={cn('shadow-none', isEmpty && 'bg-muted/20', className)}>
      <CardHeader
        className={cn('py-3 px-4', headerClassName)}
        onClick={handleHeaderClick}
      >
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
          <div className="flex items-center gap-2 min-w-0">
            {collapsible && (
              collapsed
                ? (<ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />)
                : (<ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />)
            )}
            <SectionIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <span className="truncate">{title}</span>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs font-normal h-5 px-1.5',
                relatedData.length === 0 && 'bg-muted text-muted-foreground'
              )}
              aria-label={`${relatedData.length} records`}
            >
              {relatedData.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onNew && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onNew(); }}
                className="gap-1 h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('detail.new')}
              </Button>
            )}
            {onViewAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onViewAll(); }}
                className="gap-1 h-7 text-xs"
              >
                {t('detail.viewAll')}
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {!collapsed && <CardContent className={cn('pt-0', isEmpty ? 'pb-3 px-4' : 'pb-4 px-4')}>
        {/* Filter bar — only when records justify it */}
        {showFilterInput && (
          <div className="mb-3">
            <Input
              placeholder={t('detail.filterPlaceholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Sortable column headers */}
        {sortable && effectiveColumns && effectiveColumns.length > 0 && relatedData.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {effectiveColumns.map((col: any) => {
              const field = col.accessorKey || col.field || col.name;
              if (!field) return null;
              const label = col.header || col.label || field;
              const isActive = sortField === field;
              return (
                <Button
                  key={field}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => handleSort(field)}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {label}
                  {isActive && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </Button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            {t('detail.loading')}
          </div>
        ) : isEmpty ? (
          // Friendly empty state. When `onNew` is available, surface a
          // prominent CTA so users can create the first related record in
          // one click (HubSpot / Linear pattern).
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm">
            <SectionIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <span className="text-muted-foreground italic">
              {t('detail.noRelatedRecords')}
            </span>
            {onNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNew}
                className="gap-1 h-7 text-xs mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('detail.new')}
              </Button>
            )}
          </div>
        ) : (
          <SchemaRenderer schema={viewSchema} />
        )}

        {/* Pagination controls */}
        {effectivePageSize > 0 && sortedData.length > effectivePageSize && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
              {t('detail.previousPage')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('detail.pageOf', { current: currentPage + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {t('detail.nextPage')}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>}
    </Card>
  );
};

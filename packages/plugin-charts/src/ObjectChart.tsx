
import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { useDataScope, SchemaRendererContext } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry, extractRecords } from '@object-ui/core';
import { AlertCircle } from 'lucide-react';
import { useSafeFieldLabel } from '@object-ui/i18n';

/**
 * Humanize a snake_case or kebab-case string into Title Case.
 * Local implementation to avoid a dependency on @object-ui/fields.
 */
export function humanizeLabel(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Client-side aggregation for fetched records.
 * Groups records by `groupBy` field and applies the aggregation function
 * to the `field` values in each group.
 */
export function aggregateRecords(
  records: any[],
  aggregate: { field: string; function: string; groupBy: string }
): any[] {
  const { field, function: aggFn, groupBy } = aggregate;
  const groups: Record<string, any[]> = {};

  for (const record of records) {
    const key = String(record[groupBy] ?? 'Unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }

  return Object.entries(groups).map(([key, group]) => {
    const values = group.map(r => Number(r[field]) || 0);
    let result: number;

    switch (aggFn) {
      case 'count':
        result = group.length;
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'sum':
      default:
        result = values.reduce((a, b) => a + b, 0);
        break;
    }

    return { [groupBy]: key, [field]: result };
  });
}

/**
 * Resolve groupBy field values to human-readable labels using field metadata.
 *
 * - **select/picklist** fields: maps value→label via `field.options`.
 * - **lookup/master_detail** fields: batch-fetches referenced records
 *   via `dataSource.find()` and maps id→name.
 * - **fallback**: applies `humanizeLabel()` to convert snake_case/kebab-case
 *   values into Title Case.
 *
 * The resolved data is a new array with the groupBy key replaced by its label.
 * This function is pure data-layer logic — the rendering layer does not need
 * to perform any value→label conversion.
 */
export async function resolveGroupByLabels(
  data: any[],
  groupByField: string,
  objectSchema: any,
  dataSource?: any,
  translateOption?: (value: string, fallbackLabel: string) => string,
): Promise<any[]> {
  if (!data.length || !groupByField) return data;

  const t = translateOption || ((_v: string, fallback: string) => fallback);

  const fieldDef = objectSchema?.fields?.[groupByField];
  if (!fieldDef) {
    // No metadata available — apply humanizeLabel as fallback
    return data.map(row => {
      const raw = String(row[groupByField] ?? '');
      const humanized = humanizeLabel(raw);
      return {
        ...row,
        [groupByField]: t(raw, humanized),
      };
    });
  }

  const fieldType = fieldDef.type;

  // --- select / picklist / dropdown fields ---
  if (fieldType === 'select' || fieldType === 'picklist' || fieldType === 'dropdown') {
    const options: Array<{ value: string; label: string } | string> = fieldDef.options || [];
    if (options.length === 0) {
      return data.map(row => {
        const raw = String(row[groupByField] ?? '');
        const humanized = humanizeLabel(raw);
        return {
          ...row,
          [groupByField]: t(raw, humanized),
        };
      });
    }

    // Build value→label map (options can be {value,label} objects or plain strings)
    const labelMap: Record<string, string> = {};
    for (const opt of options) {
      if (typeof opt === 'string') {
        labelMap[opt] = opt;
      } else if (opt && typeof opt === 'object') {
        labelMap[String(opt.value)] = opt.label || String(opt.value);
      }
    }

    return data.map(row => {
      const rawValue = String(row[groupByField] ?? '');
      const fallback = labelMap[rawValue] || humanizeLabel(rawValue);
      return {
        ...row,
        [groupByField]: t(rawValue, fallback),
      };
    });
  }

  // --- lookup / master_detail fields ---
  if (fieldType === 'lookup' || fieldType === 'master_detail') {
    const referenceTo = fieldDef.reference_to || fieldDef.reference;
    if (!referenceTo || !dataSource || typeof dataSource.find !== 'function') {
      // Cannot resolve — return as-is
      return data;
    }

    // Collect unique IDs to fetch
    const ids = [...new Set(data.map(row => row[groupByField]).filter(v => v != null))];
    if (ids.length === 0) return data;

    // Derive the ID field from metadata (fallback to 'id')
    const idField: string = fieldDef.id_field || 'id';

    try {
      const results = await dataSource.find(referenceTo, {
        $filter: { [idField]: { $in: ids } },
        $top: ids.length,
      });
      const records = extractRecords(results);

      // Build id→label map using display field from metadata with sensible fallbacks
      const displayField: string =
        fieldDef.reference_field || fieldDef.display_field || 'name';
      const idToName: Record<string, string> = {};
      for (const rec of records) {
        const id = String(rec[idField] ?? rec.id ?? rec._id ?? '');
        const name = rec[displayField] || rec.name || rec.label || rec.title || id;
        if (id) idToName[id] = String(name);
      }

      return data.map(row => {
        const rawValue = String(row[groupByField] ?? '');
        return {
          ...row,
          [groupByField]: idToName[rawValue] || rawValue,
        };
      });
    } catch (e) {
      console.warn('[ObjectChart] Failed to resolve lookup labels:', e);
      return data;
    }
  }

  // --- fallback for other field types ---
  return data.map(row => ({
    ...row,
    [groupByField]: humanizeLabel(String(row[groupByField] ?? '')),
  }));
}

// Re-export extractRecords from @object-ui/core for backward compatibility
export { extractRecords } from '@object-ui/core';

export const ObjectChart = (props: any) => {
  const { schema } = props;
  const context = useContext(SchemaRendererContext);
  const dataSource = props.dataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);
  const { fieldOptionLabel } = useSafeFieldLabel();
  // Keep a stable ref to fieldOptionLabel — the i18n hook returns a fresh
  // function reference on every render, which would otherwise invalidate
  // fetchData's useCallback identity and trigger an infinite refetch loop.
  const fieldOptionLabelRef = useRef(fieldOptionLabel);
  useEffect(() => {
    fieldOptionLabelRef.current = fieldOptionLabel;
  }, [fieldOptionLabel]);
  
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable JSON keys for aggregate/filter so that callers passing a fresh
  // object literal on each render (e.g. DashboardRenderer.getComponentSchema)
  // do not trigger infinite refetch loops.
  const aggregateKey = useMemo(
    () => (schema.aggregate ? JSON.stringify(schema.aggregate) : ''),
    [schema.aggregate],
  );
  const filterKey = useMemo(
    () => (schema.filter ? JSON.stringify(schema.filter) : ''),
    [schema.filter],
  );

  const fetchData = useCallback(async (ds: any, mounted: { current: boolean }) => {
      if (!ds || !schema.objectName) return;
      if (mounted.current) {
        setLoading(true);
        setError(null);
      }
      try {
          let data: any[];

          // Prefer server-side aggregation when aggregate config is provided
          // and dataSource supports the aggregate() method.
          if (schema.aggregate && typeof ds.aggregate === 'function') {
              const results = await ds.aggregate(schema.objectName, {
                  field: schema.aggregate.field,
                  function: schema.aggregate.function,
                  groupBy: schema.aggregate.groupBy,
                  filter: schema.filter,
              });
              data = Array.isArray(results) ? results : [];
          } else if (typeof ds.find === 'function') {
              // Fallback: fetch all records and aggregate client-side
              const results = await ds.find(schema.objectName, {
                 $filter: schema.filter
              });
              
              data = extractRecords(results);

              // Apply client-side aggregation when aggregate config is provided
              if (schema.aggregate && data.length > 0) {
                  data = aggregateRecords(data, schema.aggregate);
              }
          } else {
              return;
          }

          // Resolve groupBy value→label using field metadata.
          // The groupBy field is determined from aggregate config or xAxisKey.
          const groupByField = schema.aggregate?.groupBy || schema.xAxisKey;
          if (groupByField && typeof ds.getObjectSchema === 'function') {
              try {
                  const objectSchema = await ds.getObjectSchema(schema.objectName);
                  data = await resolveGroupByLabels(
                    data,
                    groupByField,
                    objectSchema,
                    ds,
                    (value, fallback) => fieldOptionLabelRef.current(schema.objectName, groupByField, value, fallback),
                  );
              } catch {
                  // Schema fetch failed — continue with raw values
              }
          }

          if (mounted.current) {
              setFetchedData(data);
          }
      } catch (e) {
          console.error('[ObjectChart] Fetch error:', e);
          if (mounted.current) {
              setError(e instanceof Error ? e.message : 'Failed to load chart data');
          }
      } finally {
          if (mounted.current) setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, aggregateKey, filterKey, schema.xAxisKey]);

  useEffect(() => {
    const mounted = { current: true };

    if (schema.objectName && !boundData && !schema.data) {
        fetchData(dataSource, mounted);
    }
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, dataSource, boundData, schema.data, filterKey, aggregateKey, fetchData]);

  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : [];

  // Merge data if not provided in schema
  const finalSchema = {
    ...schema,
    data: finalData
  };
  
  if (loading && finalData.length === 0) {
      return <div className={"flex items-center justify-center text-muted-foreground text-sm p-4 " + (schema.className || '')} data-testid="chart-loading">Loading chart data…</div>;
  }

  // Error state — show the error prominently so issues are not hidden
  if (error) {
      return (
        <div className={"flex flex-col items-center justify-center gap-2 p-4 " + (schema.className || '')} data-testid="chart-error" role="alert">
          <AlertCircle className="h-6 w-6 text-destructive opacity-60" />
          <p className="text-xs text-destructive font-medium">Failed to load chart data</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">{error}</p>
        </div>
      );
  }

  if (!dataSource && schema.objectName && finalData.length === 0) {
      return <div className={"flex items-center justify-center text-muted-foreground text-sm p-4 " + (schema.className || '')} data-testid="chart-no-datasource">No data source available for &ldquo;{schema.objectName}&rdquo;</div>;
  }

  return <ChartRenderer {...props} schema={finalSchema} />;
};

// Register it
ComponentRegistry.register('object-chart', ObjectChart, {
    namespace: 'plugin-charts',
    label: 'Object Chart',
    category: 'view',
    inputs: [
        { name: 'objectName', type: 'string', label: 'Object Name', required: true },
        { name: 'data', type: 'array', label: 'Data', description: 'Optional static data' },
        { name: 'filter', type: 'array', label: 'Filter' },
        { name: 'aggregate', type: 'object', label: 'Aggregate', description: 'Aggregation config: { field, function, groupBy }' },
    ]
});

---
"@object-ui/plugin-report": patch
---

Remove the dead pre-9.0 client-side report-aggregation pipeline. ADR-0021 moved aggregation into the semantic layer (`queryDataset`), leaving the `useReportData` hook and its helpers (`buildAggregateQuery`, `groupAndAggregate`, `pivotRows`, `aggregateRows`, `collectFields`, `columnKey`, `bucketDate`, `groupingValue`) and the `ReportRow` / `PivotMatrix` / `PivotHeader` / `UseReportDataResult` / `UseReportDataOptions` types with zero consumers across the monorepo and all product repos. The still-used `mergeFilters` combinator moves to its own module and remains exported from the package root.

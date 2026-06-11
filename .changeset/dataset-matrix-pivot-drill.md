---
"@object-ui/plugin-report": minor
"@object-ui/app-shell": minor
---

ADR-0021 D2: true matrix cross-tab + dataset-path drill-down.

- DatasetReportRenderer pivots `type: 'matrix'` reports into a real rows × columns cross-tab (one dataset query over all dimensions, pivoted client-side; matrix without `columns` degrades to the flat grouped table). Joined blocks pivot too.
- Drill-down: aggregated rows / matrix cells are clickable when the host passes `onDrill` (and the report doesn't set `drilldown: false`), emitting `{dataset, groupKey, runtimeFilter}`. ReportView resolves the dataset's object + dimension→field mapping (reverse-mapping select option labels back to stored values) and navigates to the object list scoped by `?filter[field]=value`.
- Studio: the report inspector gains a Columns (across dimensions) list for matrix reports; ReportPreview renders through the same DatasetReportRenderer as the runtime, so the matrix preview is WYSIWYG.

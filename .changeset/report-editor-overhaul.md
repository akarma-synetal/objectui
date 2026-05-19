---
'@object-ui/plugin-report': minor
'@object-ui/components': patch
'@object-ui/i18n': patch
---

**Report editor panel overhaul**

The report configuration panel is now safe to open on any spec-shape `Report` and only exposes fields that are actually persisted by `@objectstack/spec`.

`@object-ui/plugin-report`:
- Add a bidirectional `SpecFilterAdapter` so `ReportConfigPanel` can edit
  spec `FilterCondition` filters (`{field: value}`, `{field: {$op: value}}`,
  top-level `$and`/`$or`). Complex / nested filters fall back to a
  read-only banner and are preserved verbatim on save.
- Drop sections that never round-tripped through the spec
  (`conditionalFormatting`, `sections`, `export`, `schedule`, `appearance`)
  and their helper components.
- Add type-driven section visibility: `tabular` shows Columns/Filters,
  `summary` adds Rows + Chart, `matrix` adds Rows + Columns axis + Chart.
- New `GroupingsBuilder` covers `groupingsDown`/`groupingsAcross` with
  `sortOrder` and date-aware `dateGranularity` controls.
- New `ColumnsEditor` lets users reorder picked columns, override labels,
  set aggregates and choose a display format.
- Chart subset now mirrors the spec: chart `title`, `showLegend`,
  `showDataLabels`, plus `funnel` (scatter removed).
- Validation banner highlights missing `objectName` and missing
  rows/columns for `matrix`/`summary` reports.
- All editor labels and hints are i18n-driven (`report.editor.*`).
- 18 new unit tests cover the filter adapter round-trip.

`@object-ui/components`:
- `FilterBuilder` now guards against malformed external `value` props.
  Previously a spec-shape filter (`{is_active: true}`) would crash the
  component on first render; the builder now falls back to an empty
  AND group whenever `value` is not a valid `FilterGroup`.

`@object-ui/i18n`:
- Add `report.editor.*` strings to `en` and `zh`.

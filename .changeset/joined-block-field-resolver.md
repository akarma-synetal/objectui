---
'@object-ui/plugin-report': minor
'@object-ui/app-shell': patch
---

feat(plugin-report): per-block field resolution for joined reports

Joined report blocks can override `objectName` to query a different
object than the container, but the editor was always offering the
container's fields — wrong field names, wrong types, broken granularity
and chart-axis filtering.

`ReportConfigPanel` now accepts an optional `getFieldsForObject`
resolver. `JoinedBlocksEditor` uses it to source fields for each
block based on `block.objectName ?? containerObjectName`, falling
back to the static `availableFields` when the resolver returns
`undefined` (unknown object).

`ReportView` wires the resolver against the app's loaded `objects`
list and reuses the same parsing path internally to derive its
top-level `availableFields`, removing the duplicated schema lookup.

5 new RTL tests verify the resolver wiring, fallback behaviour,
add-block flow, and inline duplicate-name validation (111 plugin-report
tests green).

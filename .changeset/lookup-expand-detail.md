---
'@object-ui/app-shell': patch
'@object-ui/layout': patch
'@object-ui/fields': patch
---

fix(detail): expand lookup fields so subtitle + lookup cells show display names

The record-page fetch in `RecordDetailView` (the page-mode path) now
requests `$expand` for every lookup/master_detail field on the object,
mirroring the behaviour the legacy `DetailView` already had. Combined
with two small downstream fixes — `PageHeader` subtitle interpolation
now extracts `name/label` from expanded reference objects instead of
rendering `[object Object]`, and `LookupCellRenderer` now short-circuits
to `pickRecordDisplayName` when the value is already a nested record —
all `record:*` renderers and the page header subtitle (`Owned by
{account}`) now display the related record's name rather than the raw
foreign-key id.

---
"@object-ui/plugin-detail": major
"@object-ui/components": major
---

**Phase O.0 — fix: related-list shows wrong records (critical data bug)**

`RelatedList` previously called `dataSource.find(api)` with no filter
when auto-fetching, so every Related tab dumped the entire target
object table instead of the records that actually reference the
current parent (e.g. an Account showed every Contact in the system,
not only contacts of that account).

Two coupled fixes:

1. `RelatedList` now requires `parentId` + `referenceField` to auto-
   fetch. When both are present it calls `dataSource.find(api,
   { $filter: { [referenceField]: parentId } })`. When either is
   missing it renders the empty state and logs a developer warning —
   never silently fetches the whole object.
2. `RelatedCountStore` was sending the probe query as `{ where, limit }`
   which most data-source adapters silently ignored (the codebase
   convention is `{ $filter, $top }`). The tab-count badges were
   therefore showing the global object count, not the parent-scoped
   count. Switched to `$filter` / `$top` to match.

`record:related_list` renderer threads `ctx.recordId` through as
`parentId`; no schema author changes required.

**Breaking:** custom callers that depended on `RelatedList` fetching
the entire object table when `referenceField` is omitted will need to
either pass `data` explicitly or supply both `parentId` and
`referenceField`. The previous behaviour was a bug, not a feature.

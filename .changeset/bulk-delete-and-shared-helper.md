---
"@object-ui/types": minor
"@object-ui/data-objectstack": minor
"@object-ui/core": minor
"@object-ui/plugin-grid": patch
---

Add `DataSource.bulkDelete(resource, ids)` as the symmetric counterpart
to `bulkUpdate`. Implemented in `data-objectstack` via the client's
`deleteMany` primitive with a per-id fallback that emulates
`continueOnError` semantics for older clients.

Extract the bulk-vs-per-row decision into a reusable
`executeBulkBatch(input, ops)` helper in `@object-ui/core`:

- Single decision tree shared by both update and delete fast paths.
- Bulk success → no per-row pass.
- Bulk partial-count → aggregate batch error.
- Bulk throw → per-row fallback so users still get id-level error detail.

`useBulkExecutor` in plugin-grid now uses the helper for both `update`
and `delete` batches, cutting "delete 500 selected rows" from 500 HTTP
requests down to ~3.

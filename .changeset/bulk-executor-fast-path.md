---
"@object-ui/plugin-grid": minor
---

`useBulkExecutor` now collapses an `update` batch into a single
`dataSource.bulkUpdate(resource, ids, patch)` call when the adapter
exposes the bulk primitive — turning "mark 500 notifications read"
from 500 PATCH calls into 1.

- Adapters without `bulkUpdate` keep working unchanged (per-row path).
- Single-row batches stay per-row (no win, just overhead).
- `delete`/`custom` operations are unchanged.
- On bulk throw, the executor falls back to per-row updates for that
  batch so users still get id-level error attribution.
- Partial server counts (`succeeded < total`) surface as one aggregate
  error entry per batch — bulk endpoints rarely report per-row failures.
- Pre-mutation snapshot and `undo()`/`retry()` still work because the
  snapshot is captured client-side before any mutation.

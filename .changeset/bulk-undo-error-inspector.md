---
'@object-ui/plugin-grid': minor
---

**Bulk actions (Phase 2): undo last batch + per-row error inspector.**

`useBulkExecutor` now snapshots the pre-mutation values for every successful row in an `update` run (limited to keys actually touched by the patch). The dialog's result step exposes:

- **Undo** — a one-shot button that replays the snapshot through `dataSource.update`, restoring the prior values. Available only for `update` operations where at least one row landed; consumed after a single click so a sticky toast can't double-revert.
- **Per-row error inspector** — failed rows are listed with an inline **Retry** affordance that re-attempts the original op + params for that record and drops the row from the error list on success.

Notes:
- `delete` and `custom` operations never accumulate a snapshot — undoing a delete from the client would silently miss server-side cascades, so the button is hidden up-front.
- The CSV export of all errors is unchanged.
- 5 new tests in `useBulkExecutor.test.ts` cover snapshot capture, failure filtering, undo replay, delete no-op, and retry-clears-error.

---
'@object-ui/types': minor
'@object-ui/core': minor
'@object-ui/data-objectstack': minor
---

feat: Optimistic Concurrency Control (OCC) on DataSource writes

`DataSource.update()` and `DataSource.delete()` now accept an optional fourth /
third argument `opts?: { ifMatch?: string }`. When supplied, adapters forward
the token to the backend; servers that implement OCC (e.g. ObjectStack
`>=4.2.0`) compare it against the record's current `updated_at` and reject
with `409 CONCURRENT_UPDATE` on mismatch, preventing silent overwrites in
multi-user editing scenarios.

**`@object-ui/data-objectstack`**

- Exports `ConcurrentUpdateError` (carries `currentVersion` and
  `currentRecord`) and `isConcurrentUpdateError()` type guard.
- `update()` / `delete()` accept `opts.ifMatch` and forward it via the
  `@objectstack/client` data API (header: `If-Match`). Requires
  `@objectstack/client@>=4.1.2` for the header to reach the server;
  older clients silently drop the option and fall back to today's
  "last writer wins" behaviour.
- Adapter-level error handling maps a 409 with `code === 'CONCURRENT_UPDATE'`
  into a typed `ConcurrentUpdateError` so callers can detect and recover
  from conflicts without parsing the wire format.

**`@object-ui/core`**

- `ApiDataSource.update()` and `.delete()` accept `opts.ifMatch` and emit
  the `If-Match` HTTP header.

UI consumers (Detail view, inline cell-edit) will be wired in a follow-up
patch to capture `updated_at` at load time, pass it as `ifMatch` on save,
and present a Reload / Overwrite / Cancel dialog on conflict.

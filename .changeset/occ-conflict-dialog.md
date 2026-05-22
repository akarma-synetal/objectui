---
'@object-ui/plugin-detail': minor
---

feat(plugin-detail): conflict-resolution dialog for OCC

When inline record-detail edits race a concurrent writer, the bound
DataSource now raises `ConcurrentUpdateError` (HTTP 409
`CONCURRENT_UPDATE`). `RecordDetailsRenderer` catches it and opens a
new `<ConcurrentUpdateDialog>` showing the user's pending value next
to the server's current value, with three resolution paths:

- **Reload latest** — discard the pending edit and refetch.
- **Overwrite anyway** — retry against the server's freshest version
  (still OCC-checked, but acknowledges "I've seen the newer version").
- **Cancel** — close the dialog and leave the form untouched.

The renderer now forwards `record.updated_at` as `{ ifMatch }` to
`dataSource.update()`, so the server can detect stale writes. The
component is re-exported as `ConcurrentUpdateDialog` /
`isConcurrentUpdateError` from `@object-ui/plugin-detail` for hosts
that need to surface the same UX from custom save paths.

End-to-end OCC requires `@objectstack/client@>=4.2.0` (now wired) and
backend support in `@objectstack/rest@>=4.2.0`.

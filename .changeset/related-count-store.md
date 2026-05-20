---
'@object-ui/components': minor
'@object-ui/plugin-grid': minor
---

feat(components): add `RelatedCountStore` runtime cache + `useRelatedCount`
hook (built on `useSyncExternalStore`, no new deps). Replaces
`PageTabsRenderer`'s local per-instance `derivedCounts` state with a
shared module-scoped store so multiple consumers of the same
object/parent pair share a single probe.

Wires `useBulkExecutor` to call `RelatedCountStore.invalidate(resource)`
after any successful bulk update/delete, so related-list badges on
parent records re-probe automatically on the next render instead of
showing stale counts.

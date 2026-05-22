---
'@object-ui/console': patch
---

chore: bump `@objectstack/client` and `@objectstack/cli` to `^4.2.0`

Brings in the published Optimistic Concurrency Control surface
(`If-Match` header on `data.update`/`data.delete`, `409
CONCURRENT_UPDATE` response shape with `currentVersion` /
`currentRecord`) so the inline-edit save path can actually push the
`ifMatch` token through.

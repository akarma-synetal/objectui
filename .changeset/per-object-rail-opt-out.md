---
'@object-ui/app-shell': patch
'@object-ui/plugin-detail': patch
---

feat(detail): per-object Reference Rail opt-out via `objectDef.detail.hideReferenceRail`

The Record-detail Reference Rail (right-hand related-list summary cards)
can now be suppressed on a per-object basis without authoring a full
custom `Page`. Catalog-style objects (Product, Task) ship with the rail
off by default; hub objects (Account, Opportunity, Contact, Case) keep it
on.

- `RecordDetailView` now reads `(objectDef as any)?.detail?.hideReferenceRail`
  and `…?.hideRelatedTab` and threads them to `buildDefaultPageSchema`.
- The Reference Rail renderer also accepts entries authored as either a
  flat `entries` array or nested under `properties.entries`, so explicit
  `Page` authors can opt-in via the standard spec shape.
- See `packages/plugin-detail/README.md` (Reference Rail decision matrix)
  for the rationale and per-object guidance.

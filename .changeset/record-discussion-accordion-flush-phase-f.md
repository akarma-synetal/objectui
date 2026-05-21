---
"@object-ui/react": minor
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
"@object-ui/components": minor
---

feat(detail): record:discussion schema component + flush accordion variant

- New `record:discussion` schema type lets authors place the record
  chatter feed anywhere in a custom Page schema. Wired through a
  shared `DiscussionContext` provider on the `assignedPage` branch
  of `RecordDetailView`; auto-append still applies when no explicit
  `record:discussion` / `record:chatter` node is present.
- `page:accordion` gains a `variant` prop. Default `flush` strips the
  per-item border so accordion sections no longer double-wrap inner
  Card-bearing renderers (RelatedList, etc.). Authors who want the
  old visual pass `variant: 'card'`.
- `translateLabel` now handles compound labels split by `&`, `and`,
  or `和` (e.g. `Notes & Attachments` → `备注与附件`).

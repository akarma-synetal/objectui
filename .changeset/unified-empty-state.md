---
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
---

Unify empty-state visuals across timeline + registered `empty` renderer.

- `RecordActivityTimeline` and `ActivityTimeline` now use `DataEmptyState`
  instead of a bare `<p>` so empty timelines match list/related-list visuals
  (muted icon badge + centered copy).
- The `ui:empty` schema renderer now delegates to `DataEmptyState`, giving
  schema-driven empty regions the same chrome as ad-hoc consumers.

---
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': minor
---

feat(detail): synthesize Related / Activity / History tabs + record:quick_actions header (Track 3 Phase G slice 4)

- `buildDefaultPageSchema` now accepts `headerActions`, `related`,
  `showActivity`, and `history` options. When provided, the synthesizer
  emits a `record:quick_actions` node after `page:header` and appends
  the corresponding tabs to `page:tabs.items` in stable order
  (Details / Related / Activity / History).
- New `record:history` renderer wraps the existing `HistoryTimeline`,
  reading `entries` / `loading` from the schema. Host owns fetching.
- `RecordDetailView` forwards `detailSchema.actions[0].actions`,
  `detailSchema.related[]` (unwrapped to `{objectName,relationshipField}`),
  and `detailSchema.history` into the synthesizer call so the
  `renderViaSchema` path reaches parity with the monolithic DetailView
  tab strip and header action bar.
- 6 new unit tests covering headerActions emit/skip, Related tab
  shape, Activity opt-in, History entries pass-through, and stable
  tab ordering.

No behavior change for objects without the `renderViaSchema` opt-in.

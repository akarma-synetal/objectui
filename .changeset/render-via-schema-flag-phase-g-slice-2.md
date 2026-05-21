---
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
"@object-ui/components": minor
---

feat(detail): renderViaSchema opt-in routes default detail through SchemaRenderer (Track 3 Phase G slice 2)

When `?renderViaSchema=1` is in the URL, or `objectDef.detail.renderViaSchema === true`,
`RecordDetailView`'s no-assignedPage branch now synthesizes a canonical
Page schema (`page:header` → `record:highlights` → `record:path` →
`page:tabs(record:details)` → `record:discussion`) via
`buildDefaultPageSchema(objectDef, { sections, highlightFields })` and
renders it through the existing `<SchemaRenderer>` pipeline.

This means every object without a custom assigned page can opt in to
the same chrome (record-aware header chip, chevron path, flush
accordion, discussion slot) that custom Lightning pages already enjoy.

Changes:
- `buildDefaultPageSchema` now emits `page:tabs.items` (correct shape
  for the renderer) rather than `tabs`.
- `PageHeaderRenderer.resolvedTitle` honors `objectSchema.primaryField`
  before the legacy `name/title/display_name/label` fallbacks.
- `RecordDetailView` rebuilds the synthesized schema with
  `detailSchema.sections` + `highlightFields` at render time so
  `record:details` inherits the same field layout the legacy
  `<DetailView>` would have produced.

Flag is intentionally off by default — flipping the default is a
separate explicit commit after empirical parity validation across
multiple objects. Known gaps tracked for slice 3: titleFormat
fallback for objects without `primaryField`, auto Activity / History
tabs, header-action buttons.

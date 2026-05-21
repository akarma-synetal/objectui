---
"@object-ui/plugin-detail": minor
---

feat(detail): buildDefaultPageSchema synthesizer (Track 3 Phase G slice 1)

Pure-function synthesizer that emits a canonical Lightning-style Page
schema (`page:header` → `record:highlights?` → `record:path?` →
`page:tabs` → `record:discussion?`) from an object definition and
optional overrides. Also exports helpers `detectStatusField`,
`deriveStages`, `deriveHighlightFields`.

This is the foundation for converging the default `<DetailView>`
output with custom Lightning pages. Phase H will wire it into
`RecordDetailView`'s non-assignedPage branch so the default detail
page renders through the same `<SchemaRenderer>` pipeline as custom
pages, inheriting all Phase D/E/F polish automatically.

No runtime behaviour change in this slice — synthesizer is exported
but not yet consumed.

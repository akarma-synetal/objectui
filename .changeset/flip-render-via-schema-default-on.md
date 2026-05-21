---
'@object-ui/app-shell': minor
---

feat(detail): default-on renderViaSchema for non-assignedPage records

Track 3 Phase G slice 6. The synthesized Page schema path (slice 2,
behind `?renderViaSchema=1`) is now the default rendering pipeline for
every object without a custom assignedPage. Visual and functional
parity verified on task and account before flipping.

Switches preserved: `?renderViaSchema=0` URL fallback,
`objectDef.detail.renderViaSchema = false` per-object opt-out.

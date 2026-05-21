---
"@object-ui/components": minor
"@object-ui/plugin-detail": minor
---

Phase N.3 + N.4 + N.6: record detail visual polish.

**N.3 — Highlight strip packs left.** `HeaderHighlight` no longer
stretches a 1-2 chip strip across the full page. Each cell is now
`min-w-[8rem] max-w-[16rem]` and wraps via flexbox so sparse strips
sit naturally at the left edge.

**N.4 — De-duplicate highlight ↔ body.** `record:details` accepts a
new `hideFields: string[]` prop. The synth pipeline auto-populates it
with the highlight-strip field list so a field surfaced in
`record:highlights` no longer appears a second time in the section
grid below. Authors can also set it directly on the schema.

**N.6 — Tab count badges only show when >0.** `page:tabs` suppresses
the count pill when the count is exactly 0 (was rendering "0" as a
muted badge on every empty Activity/History tab).

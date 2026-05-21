---
"@object-ui/app-shell": patch
---

fix(app-shell): suppress duplicate discussion panel on record detail pages

`RecordDetailView` auto-appends a `RecordChatterPanel` below the
rendered page unless an explicit `record:discussion` / `record:chatter`
node is found in the schema. The detection walker recursed into
`children / items / body / components / properties.*` but **not**
`regions[]`. Synthesised pages (`buildDefaultPageSchema`) and authored
full-Lightning pages place `record:discussion` inside
`regions[0].components`, so the walker missed it and a second
discussion panel rendered on top of the first.

Extracted the walker into `utils/pageSchemaIntrospect.ts`, added a
`regions` branch, and covered both shapes with unit tests.

Verified in browser on account (slotted), opportunity (full), lead,
contact, and task — each renders exactly one discussion panel.

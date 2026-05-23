---
"@object-ui/types": minor
"@object-ui/plugin-detail": minor
---

`record:path` now distinguishes won/lost terminal stages. Stages can opt
in via the new `terminal: 'won' | 'lost'` property on each stage entry,
and the renderer also falls back to a value/label heuristic (matches
`closed_lost`, `lost`, `failed`, `cancelled`, `失败`, `流失`, `丢单`, etc.)
so existing CRM-style picklists get the treatment without migration.

- **Lost** stages render in a visually separated group with a left
  border, destructive (red) tint, pill shape, and `✗` glyph — mirroring
  the Salesforce / HubSpot alt-terminus pattern that signals "this
  breaks the forward path, not steps past it."
- **Won** terminus (the last stage of the forward chevron) gets a subtle
  emerald wash + 🏆 glyph to read as "the goal," even before the record
  reaches it.
- Mobile pill row distinguishes lost via color, since the layout doesn't
  have room to fork the row.

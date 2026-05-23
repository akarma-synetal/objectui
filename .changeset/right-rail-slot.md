---
"@object-ui/plugin-detail": minor
---

`buildDefaultPageSchema` now accepts a `slots.rightRail` override that
contributes nodes to the aside (right-rail) region. The aside region is
emitted whenever either the auto-detected reference rail OR
`slots.rightRail` is non-empty (previously: only when 2+ related lists
were declared). Slot contributions are appended after the canonical
`record:reference_rail` so the "related summary" stays anchored at the
top while plugins can drop activity feeds, workflow status cards,
presence lists, etc. beneath it.

No change for existing schemas — the aside region only renders if
something opts in.

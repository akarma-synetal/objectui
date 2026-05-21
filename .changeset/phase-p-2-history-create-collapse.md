---
"@object-ui/plugin-detail": minor
---

**Phase P.2 — Collapse CREATE event field-dump in History timeline.**

CREATE events render every populated field as a `from: — → to: value`
diff row. For a record with 20+ fields this turned the History tab
into a wall of debug-looking `Field: — → value` lines.

For `action === 'create'` we now render a single `▸ N fields
populated` disclosure that expands on click. The expanded view shows
just `Field: value` (no useless `— →` arrow), since for a creation
event the "from" is implicitly empty.

UPDATE / DELETE events are unchanged — their field diffs are
genuinely informative.

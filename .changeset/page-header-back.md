---
"@object-ui/layout": patch
---

feat(page-header): back-to-list arrow on record pages

`page:header` now renders a ← back arrow at the left when a record
context with an id is present. Clicking it strips the trailing
`/record/{id}` segment from the URL so users return to the object list,
falling back to `history.back()` for deep-linked entry. The legacy app
pages without a record context are unaffected.

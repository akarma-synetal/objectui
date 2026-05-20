---
"@object-ui/plugin-detail": patch
---

feat(detail): pair quick actions with header, suppress duplicate title chip

- `record:quick_actions` placed at `record_header` now visually pairs
  with the surrounding `page:header` (Salesforce Lightning placement)
  instead of orphaning into its own row below the title.
- `record:details` defaults to `showHeader: false` on the inner
  DetailView so embedded record pages no longer render a duplicate
  title chip + star/copy buttons under the page header. The legacy
  standalone DetailView screens are unaffected (showHeader defaults
  to true on that direct path).

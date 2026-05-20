---
"@object-ui/layout": patch
"@object-ui/plugin-detail": patch
---

feat(detail): Salesforce-style record header + section field grid

- `page:header` now renders an icon chip (resolves Lucide names via
  `LazyIcon`) plus subtitle, so detail pages can show
  "Name / Company" without an extra component.
- `record:details` normalises string field entries (`fields: ['email']`)
  into the `{name, label?}` shape expected by `DetailSection`, and maps
  section `label` → `title`. Schemas authored against `@objectstack/spec`
  now produce a real grouped field grid instead of an empty card.

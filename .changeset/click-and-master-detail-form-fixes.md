---
'@object-ui/plugin-grid': patch
'@object-ui/plugin-form': patch
'@object-ui/fields': patch
---

Fix click navigation and required-FK form rendering

- **plugin-grid**: ObjectGrid's `getSelectFields()` now always includes `id` in
  the SELECT projection. Previously, when a view configured `columns` without
  `id`, the SQL driver stripped it from results, and row-click handlers silently
  no-oped because `record.id` was undefined.

- **plugin-form / fields**: Master-detail fields now render as a single-value
  lookup picker (`LookupField`) in create/edit forms instead of a one-to-many
  related-list widget. From the child-side, master-detail is the FK to the
  parent record and is typically NOT NULL — it must appear in forms. Prior
  behavior dropped it via the auto-layout exclusion list, which caused server
  errors like "NOT NULL constraint failed: contact.account" when users tried
  to create child records.

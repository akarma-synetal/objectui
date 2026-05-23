---
"@object-ui/fields": patch
"@object-ui/plugin-kanban": patch
---

CRM polish — denser kanban cards, smarter currency, calmer dates.

- **plugin-kanban card body**: drop the verbose `Label: value` two-column
  grid in favor of a single-column dense list (values only, with the
  field label preserved as a hover `title` for accessibility). Pipeline
  cards across Salesforce / HubSpot / Linear all do this because the
  value's own type carries its meaning, and the saved space lets the
  title breathe.
- **fields/formatCurrency**: drop trailing `.00` when the value is a
  whole number (Salesforce convention: `$1,234.50` keeps cents,
  `$1,234` doesn't). Pipeline amounts like `500,000.00` now read as
  `500,000`.
- **fields/formatDate** default branch: drop the year when it matches
  the current year — `7月21日` instead of `2026年7月21日`. Past- and
  future-year dates keep the year for disambiguation
  (`2025年11月23日`).
- **fields/CurrencyCellRenderer**: removed the now-redundant
  `.replace(/[.,]00$/, '')` workaround that hid cents for `precision:0`
  fields; the formatter now handles whole-unit trimming natively.

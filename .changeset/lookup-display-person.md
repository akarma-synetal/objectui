---
'@object-ui/fields': patch
'@object-ui/layout': patch
'@object-ui/plugin-detail': patch
'@object-ui/app-shell': patch
---

Lookup display-name resolution now falls back through a Salesforce-style chain
when an `$expand`'d reference object lacks a top-level `name`/`label`/
`display_name`/`title` field:

1. Standard display fields (existing behaviour)
2. `salutation first_name last_name` composite — handles person records that
   only carry first/last name parts
3. `email` — last-resort identifier, beats the opaque id

Applies to `LookupCellRenderer`, `PageHeader.subtitle` interpolation,
`DetailView` page-mode `titleFormat`, and the shared `formatRecordTitle`
utility. Concretely: a Contact reference with `first_name: Bob`, `last_name:
Lin` and no `name` field now renders as `Bob Lin` everywhere — instead of
the email or [object Object] fallback.

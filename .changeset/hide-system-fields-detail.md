---
'@object-ui/app-shell': patch
---

fix(detail): hide system/tenant fields from auto-generated record detail

The auto-generated detail section (used when an object has no explicit form
sections) was leading every record page with `organization_id` (rendered as
"ORGANIZATION: Admin's Workspace") — pure tenancy metadata with no business
value. Extended the existing audit-field filter to also drop
`organization_id`, `tenant_id`, `is_deleted`, and `deleted_at`. Objects that
intentionally surface tenant info can still do so via explicit
`views.form.sections`.

---
'@object-ui/plugin-detail': patch
---

feat(plugin-detail): cross-object detail-page convergence polish (Phase J)

Two regression fixes surfaced by the Phase J browser canary across CRM
record detail pages:

1. **`record:path` now localizes stage labels.** The renderer threads
   `useSafeFieldLabel().translateOptions` against the record-context's
   `objectName` + the schema's `statusField`, so picklist labels match the
   active locale instead of leaking English (`New / Contacted / Qualified`)
   onto zh-CN pages. Falls back to the schema's authored labels when no
   i18n provider is mounted.

2. **`deriveHighlightFields` skips system + primary fields.** Adds
   `organization_id`, `workspace_id`, `tenant_id`, `created_by`,
   `updated_by`, `deleted_by` to the skip set so the synthesized highlight
   strip stops leaking an orphan "CRM Test's Workspace" chip with no
   visible field label. Also skips the object's `primaryField` and common
   title-field candidates (`name`, `full_name`, `title`, `subject`,
   `display_name`) so the strip never duplicates the page H1.

`ObjectDefLike` gains an optional `primaryField` declaration to drive the
new skip behavior. No spec changes; the field is already part of the
upstream object schema.

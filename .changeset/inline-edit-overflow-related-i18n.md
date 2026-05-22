---
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
"@object-ui/components": patch
---

Fold inline-edit into the page-header overflow menu (HubSpot/Lightning
pattern) and remove the orphan "Edit fields" toolbar row that previously
floated between the tab strip and the first detail section.

- `@object-ui/app-shell` `RecordDetailView`: injects a new `sys_inline_edit`
  system action that appears in the ⋯ overflow menu and dispatches a
  `objectui:record:inline-edit-toggle` window CustomEvent (filtered by
  recordId + objectName).
- `@object-ui/plugin-detail` `DetailView`: listens for that event to
  toggle inline-edit mode; the in-page toolbar now renders only during
  active editing / save error / locked states, so the idle layout flows
  tabs → first section card with no orphan row.
- `@object-ui/components` layout containers: extended `KNOWN_LABEL_DICT`
  with zh-CN + zh-TW translations for common CRM related-list labels
  (Quotes / Products / Contacts / Accounts / Leads / Opportunities /
  Cases / Campaigns / Approvals / Documents / Emails / Calls / Meetings
  / Open Tasks / Closed Tasks), so authored English labels auto-translate
  in `page:accordion` / `page:tabs` items.

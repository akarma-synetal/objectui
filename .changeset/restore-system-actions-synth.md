---
"@object-ui/app-shell": patch
---

Restore Edit / Share / Delete system actions on synthesized record detail headers.

Phase G slice 6 flipped the synth detail page on by default but did not
forward the legacy DetailView's built-in system actions to the new
`record:quick_actions` bar. Objects without authored `record_header`
business actions ended up with a bare header (only the ★ favorite +
copy-id chip from `page:header`).

This patch injects gated system actions into `synthHeaderActions` for
both the synth and slotted paths:

- `sys_edit` — visible when `affordances.edit`. Calls the existing
  `onEdit` prop, opening the same form modal as before.
- `sys_share` — always visible. Uses `navigator.share` when available;
  falls back to clipboard copy of the current URL with a toast.
- `sys_delete` — visible when `affordances.delete`. Confirms via
  `window.confirm`, calls `dataSource.delete`, then navigates back to
  the list.

Business / custom actions (e.g. Lead.convert, Contact.set_primary)
continue to render alongside the system actions, unchanged. Full
Lightning pages (objects with an `assignedPage`) are unaffected — they
remain author-owned.

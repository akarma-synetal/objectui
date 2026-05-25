---
'@object-ui/app-shell': patch
---

Fix marketplace install dialog showing "No environments found" even when the
signed-in user has cloud environments. Cloud's data API returns rows under
`records`, not `data`/`items`; the dialog now reads the correct key. As a
hardening pass, also filter `sys_member` rows by the caller's session
`user_id` so a leaky data endpoint cannot widen the install target list to
other tenants' organizations.

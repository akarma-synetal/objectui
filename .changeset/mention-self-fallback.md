---
'@object-ui/app-shell': patch
---

Always seed @-mention suggestions with the current user so the dropdown
appears even when the backend has no `sys_user` directory (or the fetch
fails). Hosts with a real user roster still get the merged list —
current user first, then directory entries de-duped by id.

Previously, typing `@` in the discussion comment box was a no-op on
example backends that don't serve `sys_user`, making the feature look
broken. Authors can now at minimum mention themselves; richer rosters
are merged in automatically when available.

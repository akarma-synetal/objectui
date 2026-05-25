---
'@object-ui/app-shell': patch
---

Gate App Marketplace pages by `useIsWorkspaceAdmin()`. Non-admin members of
the active organization can no longer load the marketplace catalog, package
detail, or installed-apps pages — they get an "admin-only" empty state
instead. The marketplace nav link in the sidebar was already gated; this
closes the direct-URL gap.

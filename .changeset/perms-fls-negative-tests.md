---
'@object-ui/plugin-detail': patch
'@object-ui/plugin-list': patch
---

test(perms): add field-level permission negative tests for DetailView
and ListView. Mounts each consumer inside a `PermissionProvider` that
denies read on a specific field and asserts the field never reaches
the rendered DOM (sections, top-level fields, summary chips,
constructed list columns). Closes the automated half of the Sprint 3-A
"Known limitations" — backend enforcement is still required, but the
client-side defence-in-depth is now regression-tested.

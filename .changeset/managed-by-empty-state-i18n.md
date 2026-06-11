---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

i18n the managed-by empty states for system / append-only / better-auth object lists.

`resolveManagedByEmptyState` previously hardcoded English titles and messages (e.g. "No identity records", "No events recorded"), so list views for managed objects (identity, audit logs, system-generated records) rendered English regardless of locale. It now takes the `t` translator and resolves `list.managedBy.{system,appendOnly,betterAuth}.{title,message}` (English kept as `defaultValue` fallbacks); `ObjectView` passes its `t` through. Added the keys to the `en` and `zh` locale packs.

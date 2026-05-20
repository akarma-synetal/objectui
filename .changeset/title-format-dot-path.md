---
'@object-ui/app-shell': patch
'@object-ui/plugin-detail': patch
---

Support dotted paths (e.g. `{account.name}`) in object `titleFormat`. When a
placeholder resolves to an expanded reference object, automatically extract
its `name`/`label`/`display_name`/`title` so detail page titles render the
related record's display name instead of falling through to the object label.

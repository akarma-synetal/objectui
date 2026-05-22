---
'@object-ui/types': minor
'@object-ui/plugin-detail': minor
'@object-ui/components': minor
'@object-ui/app-shell': minor
---

Polish Lightning record detail page layout.

- `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
- Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
- The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
- Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
- Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
- Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

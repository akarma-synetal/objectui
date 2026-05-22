---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

Fix the drawer "Open as full page" (maximize) button on the record drawer
which threw `TypeError: name.indexOf is not a function` and prevented
navigation to the dedicated detail page.

- `@object-ui/app-shell` `ObjectView`: pass `objectDef.name` (string) — not
  the whole `objectDef` — into `viewLabel(...)` when computing the
  `originState.from.label` for both drawer-navigate and list-navigate
  flows. Two call sites fixed.
- `@object-ui/i18n` `useObjectLabel`: harden `stripNamespace` so it
  tolerates non-string inputs and returns an empty string instead of
  throwing, providing a safety net for similar future regressions.

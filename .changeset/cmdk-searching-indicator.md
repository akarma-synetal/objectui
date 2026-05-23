---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

feat(app-shell): CommandPalette searching indicator

When `useRecordSearch` is mid-flight (debounced fetch across objects
hasn't returned yet), the palette now surfaces a subtle visual:

- A small pulsing primary-coloured dot next to the **Records** group
  heading, so the user sees that more results may still appear.
- A `Searching…` placeholder inside the empty state when the user has
  typed something but no hits exist yet — replaces the static
  "No results found." message until the request settles.

New i18n key `console.commandPalette.searching` (en + zh).

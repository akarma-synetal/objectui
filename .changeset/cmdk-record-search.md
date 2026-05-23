---
"@object-ui/react": minor
"@object-ui/app-shell": minor
"@object-ui/i18n": minor
---

feat(cmdk): record search across objects in the Command Palette

- New `useRecordSearch` hook in `@object-ui/react` debounces a query, fans out
  to `dataSource.find(name, { $search, $top })` across candidate objects, and
  aggregates hits. Race-safe via a monotonic runId; per-object 404s are
  silently dropped via `Promise.allSettled`.
- `CommandPalette` (`@object-ui/app-shell`) now accepts a `dataSource` prop;
  when supplied, the palette renders a `Records` group at the top with hits
  scoped to the active app's nav objects. Item `value` embeds the live query
  so cmdk's client-side filter doesn't hide async results.
- Added `console.commandPalette.records` i18n key (`Records` / `记录`).

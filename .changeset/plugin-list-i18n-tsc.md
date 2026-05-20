---
'@object-ui/plugin-list': patch
'@object-ui/i18n': patch
---

Clean up pre-existing TypeScript errors in `plugin-list` and tighten i18n:

- Switch grouping-editor labels to `t(key, { defaultValue })` option form so i18next's strict types accept the literal fallback.
- Add the missing `list.addGroup` / `list.collapsedByDefault` / `list.removeGroup` keys to en + zh locale bundles.
- Drop the dead `currentView === 'list'` branch in `ListView` (local `ViewType` union has `'grid'`, never `'list'`).
- Widen `UserFilters.resolveFields` `translateOptions` parameter from a generic `<T>` to the concrete option shape so it matches the `useObjectLabel` hook's signature.

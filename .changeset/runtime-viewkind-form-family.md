---
'@object-ui/app-shell': patch
---

fix(metadata): keep form-family views out of the runtime list-view switcher

The backend now exposes each view as an independent **ViewItem** (ADR-0017,
"Object has-many View"): `{ name: '<object>.<key>', object, viewKind:
'list' | 'form', config }`. The Studio preview was already taught this shape,
but the runtime console path was not — `MetadataProvider.mergeViewsIntoObjects`
only understood the legacy aggregated container (`{ list, form, listViews,
formViews }`) and ignored `viewKind` entirely. As a result a form-family view
(e.g. `crm_activity.default`, expanded from `formViews.default`) was neither
recognized nor excluded: navigating to its `/view/<name>` URL silently fell
back to the default grid list instead of being treated as a record form.

`mergeViewsIntoObjects` now recognizes the ViewItem shape and routes by
`viewKind` — `'list'` → `objectDef.listViews`, `'form'` → `objectDef.formViews`
— so FORM-family views never enter the list-view switcher (which reads only
`listViews`). Each item's `config` body is flattened to the renderer shape so
`type`/`columns`/`calendar`/… survive, the canonical `<object>.<key>` name is
used as the view id (so `/view/<name>` resolves), and the legacy container is
skipped for any object that already has expanded ViewItems (no double-listing).
Objects served only as a legacy container are unaffected.

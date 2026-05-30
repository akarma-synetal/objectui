---
'@object-ui/data-objectstack': patch
---

fix(datasource): exclude form-family views from `listViews()`

`OBJECTSTACKDataSource.listViews(objectName)` feeds the object list-view
switcher (`ObjectView` → `ViewTabBar`), but returned **every** view bound to
the object — including form-family ones. With the backend now exposing each
view as an independent **ViewItem** carrying a `viewKind` discriminant
(ADR-0017, "Object has-many View"), a form view such as `crm_activity.default`
(expanded from `formViews.default`) leaked in as a spurious switcher tab and,
when opened, fell back to the default grid.

`listViews()` now filters out `viewKind` `form`/`detail` items so only
list-family views reach the switcher. Bare view specs without a `viewKind`
(legacy artifacts and user-saved views) are still treated as list views.

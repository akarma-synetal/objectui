---
"@object-ui/app-shell": patch
---

fix(app-shell): resolve 51 react-hooks/rules-of-hooks errors in ObjectView

ObjectView had a mid-component early return (`if (!objectDef) return …`) sitting before ~50 hooks, which violated the Rules of Hooks and risked a `Rendered fewer hooks than expected` crash if `objectDef` flipped present→absent→present on a live instance (object switch, metadata refresh, reload failure). Split the component so the missing-object empty state lives in a thin `ObjectView` wrapper, while `ObjectViewInner` (mounted only when the definition exists) calls all hooks unconditionally. Behavior is unchanged.

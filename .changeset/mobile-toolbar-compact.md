---
'@object-ui/plugin-list': minor
'@object-ui/plugin-kanban': minor
---

Mobile UI optimization: declutter list & kanban on small screens.

- **ListView toolbar** now auto-collapses HideFields / Group / Color / Density into a single settings gear at `<sm` breakpoints, even when `compactToolbar` is not enabled. Desktop behavior unchanged.
- **Kanban board** replaces the verbose "← Swipe to navigate →" caption with a compact dot indicator that tracks which column is currently snapped into view. Hidden when there is only one column.

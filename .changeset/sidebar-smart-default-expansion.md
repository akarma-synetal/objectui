---
"@object-ui/layout": minor
---

`NavigationRenderer` now resolves a group's initial open state with two
platform-aware defaults:

1. **`expanded` field honored.** `@objectstack/spec` `AppNavigation`
   uses `expanded: true | false` on group items; objectui historically
   only read `defaultOpen`. App authors who wrote `expanded: false`
   would see no effect because the renderer silently fell back to the
   "open unless `defaultOpen === false`" rule. Both field names now
   resolve to the same explicit override.

2. **Auto-collapse long groups.** When the author has set neither
   `expanded` nor `defaultOpen`, groups with **8 or more direct
   children** default to collapsed. Long sidebar sections (e.g. 10+
   reports) doubled the sidebar height and pushed siblings below the
   fold — Slack, Linear, and Notion all default-collapse oversized
   sections for the same reason. Short groups (typical 3–6 items) still
   open by default.

3. **Active-route override.** Both heuristics are bypassed when the
   current route lives inside the group, so users never lose visual
   orientation to a hidden active item.

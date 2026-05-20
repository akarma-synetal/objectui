---
'@object-ui/app-shell': minor
'@object-ui/plugin-list': minor
---

feat(app-shell,plugin-list): mobile Airtable-style topbar + filter chip row

Refactor mobile object-view layout to match the Airtable Interface
pattern:

- **AppHeader**: the mobile topbar's static page label is now a
  view-switcher dropdown (`<viewName> ▾`). Tapping opens a list of
  available views with icons + active-state checkmark. Falls back to
  plain text when only one view exists, or when the current page has
  no view-switching surface (Home, Settings, …).
- **ObjectView**: drops the standalone mobile `sm:hidden` view-select
  row that previously lived between the desktop tab bar and the
  content area. View switching is now exposed exclusively via the
  topbar dropdown on mobile, eliminating the duplicated `object name`
  vs `view name` rows.
- **ListView**: un-hides the `UserFilters` chip row on mobile.
  Single-line, horizontally scrollable, matches the Airtable Interface
  filter chip strip.
- New lightweight `MobileViewSwitcherContext` provides a
  page → header data channel (no zustand dependency added).

Net effect on mobile (390×844):

```
☰ 客户卡片 ▾                🔍 🔔 M    ← topbar
类型 ▾  行业 ▾  是否活跃 ▾  更多 3 ▾  ⛛  ← chip row
[content cards]                          ← content
                                  (+)    ← FAB
[Leads | Accounts | Contacts | …]        ← bottom nav
```

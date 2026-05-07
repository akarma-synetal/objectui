---
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-map': patch
---

Mobile UX round 3 — Gantt and Map

**@object-ui/plugin-gantt**

- Added a sticky vertical "Today" marker on the timeline plus a one-tap **Jump to Today** toolbar button so on-call users can re-orient the view instantly on small screens.
- Added a **collapsible task list** (toolbar toggle + auto-collapse on the first narrow render) so the timeline area gets the full viewport on phones.
- Added **pinch-to-zoom** touch gestures on the timeline; wired `columnWidthOverride` state so the existing zoom buttons also respond (previously a no-op).

**@object-ui/plugin-map**

- Added a **geolocate button** with the standard `navigator.geolocation.getCurrentPosition` permission flow, an inline error banner, a busy state, and a **user-location marker** (blue dot) the map flies to on success.
- **Cluster tap-through**: tapping a cluster now flies the map in (zoom + 2, capped at 20) instead of just sitting there.
- On mobile, the desktop popup is replaced by a **bottom-sheet record card** with safe-area padding and an explicit close button. Desktop continues to use the popup.

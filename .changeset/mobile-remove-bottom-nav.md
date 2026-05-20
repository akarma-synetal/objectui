---
'@object-ui/app-shell': minor
---

feat(app-shell): remove mobile bottom-tab navigation

The mobile bottom-tab strip was rendering the first 5 leaf items of
the app's navigation tree — exactly the same items that the drawer
(`☰`) surfaces, just without grouping, favourites, or recents.

Per the Notion / Linear mobile convention, we now rely on the drawer
alone. Bottom-tab strips work when they expose **orthogonal**
top-level sections (Airtable's Home / Bases / Notifications / Account)
— but ours was a duplicate of the drawer, so it was pure visual
weight: ~52px of vertical real estate, redundant taps, and clashes
with the FAB and chat-bubble stack at the bottom-right corner.

Net effect:
- Drawer remains the single source of in-app navigation.
- ~52px reclaimed for list/kanban content on every mobile screen.
- FAB and chat-bubble keep their existing offsets (no overlap;
  bottom-nav was already accounted for above them).

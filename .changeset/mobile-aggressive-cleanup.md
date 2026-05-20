---
'@object-ui/plugin-list': minor
'@object-ui/plugin-kanban': minor
'@object-ui/app-shell': minor
---

Mobile UI: aggressive chrome reduction to match real mobile-app conventions.

Real mobile CRMs (Salesforce, HubSpot, Notion, Linear) keep one row of
chrome on phones: title + 1 primary action, plus content. We were
shipping ~5 rows of toolbars + chips + tabs above the data. This commit
hides the desktop-only chrome at the `<sm` breakpoint:

- **ListView**: TabBar (view switcher), UserFilters chip row, quick-filters
  chip row, Sort button, list-scoped Search popover, and the
  (newly-added) mobile-only ViewSettingsPopover gear are all hidden on
  phones. Only the **Filter** icon survives on mobile — paired with the
  global ⌘K top-bar search, that is the entire mobile control surface.
- **Kanban**: previous commit replaced verbose swipe text with a dot
  indicator; that stands.
- **ObjectView page header**: the Import (CSV upload) button is hidden
  on mobile — CSV import is a desktop workflow.

Net effect on a 390px viewport: ListView toolbar collapses from
~10 controls (5 chips + 5 icons) to a single Filter icon next to the
title; the body of the page is reachable without scrolling past 3 rows
of chrome.

Desktop and tablet behavior is unchanged.

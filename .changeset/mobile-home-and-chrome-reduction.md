---
"@object-ui/app-shell": minor
---

Mobile UX: Home affordance + chrome reduction

Two fixes that match what users actually need on a 390px viewport:

- **Add Home link to mobile sidebar.** When inside an app, the sidebar
  drawer previously listed only the current app's nav groups, with no
  way back to the home page (the desktop topbar's logo and AppSwitcher
  pill are hidden on phones). Now the mobile sidebar opens with a
  prominent "Home" row (`/home`) at the top, gated to mobile + app
  context so the desktop layout is untouched.
- **Cut a row of top chrome.** The list/object PageHeader (icon + title
  + create / import / more actions) duplicated the page title already
  shown in the topbar. On mobile it's hidden entirely; the primary
  create action moves to a floating "+" button anchored above the
  bottom nav. Desktop still renders the full PageHeader.

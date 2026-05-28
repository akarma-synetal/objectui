---
'@object-ui/app-shell': minor
---

**Wire `App.hidden` shell hint — App Switcher + avatar dropdown**

Honour the new `App.hidden` field from `@objectstack/spec/ui`:

- **`AppSwitcher.tsx`** — filter `app.hidden === true` out of the top-bar app dropdown so personal-settings-style apps don't appear next to business apps.
- **`AppHeader.tsx`** — render hidden apps as entries in the avatar / user dropdown (immediately after the hardcoded Profile / Settings items). Uses the app's `icon` + `label` via the existing `getIcon` + `appLabel` utilities, and navigates to `/apps/${app.name}`.

This is the front-end side of the Account-app split: the `account` app shipped by `@objectstack/platform-objects` declares `hidden: true` and now surfaces through the avatar menu — same pattern as GitHub Settings, Google account chip, and Salesforce Personal Settings.

No new dependencies; pure metadata-driven wiring.

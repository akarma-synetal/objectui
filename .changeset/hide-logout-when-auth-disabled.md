---
'@object-ui/auth': patch
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

fix(auth,app-shell): hide Log out menu item when auth is disabled (guest/preview mode)

When the console runs against a server with `discovery.services.auth.enabled === false`
(or in preview mode), `AuthProvider` hardcodes `isAuthenticated: true` and the mock
`signOut()` has no real backend. Previously, clicking "Log out" in the user menu had
no visible effect — the user/session were nulled but the UI stayed authenticated.

Changes:
- **`@object-ui/auth`** — added `isAuthEnabled: boolean` to `AuthContextValue`
  (`true` only when real auth is in use, `false` for guest/preview modes).
- **`@object-ui/app-shell`** — `AppHeader` and `AppSidebar` now hide the "Log out"
  menu item entirely when `!isAuthEnabled`, so users aren't presented with an action
  that can't actually do anything. Also fixed two missed i18n strings in
  `AppSidebar` ("Settings", "Log out").
- **`@object-ui/i18n`** — added `user.{profile,settings,logout}` namespace to all
  10 built-in locales (en/zh translated; ja/ko/de/fr/es/pt/ru/ar fall back to
  English pending native translation).

---
"@object-ui/app-shell": minor
"@object-ui/console": minor
---

feat(observability): Sentry integration + bundle splitting for production launch

**Sentry (opt-in via `VITE_SENTRY_DSN`)**

- New `initSentry()` / `captureError()` / `setSentryUser()` / `getSentry()`
  helpers exported from `@object-ui/app-shell`.
- Dynamic-import design: when `VITE_SENTRY_DSN` is unset, `@sentry/react`
  is **never fetched** — zero bundle cost for self-hosted users.
- `ErrorBoundary.componentDidCatch` now best-effort reports to Sentry.
- Console app calls `initSentry()` before React mount; never blocks first
  paint.
- Configurable via:
  - `VITE_SENTRY_DSN` — required to enable
  - `VITE_SENTRY_ENVIRONMENT` — defaults to `MODE`
  - `VITE_SENTRY_RELEASE` — defaults to `VITE_APP_VERSION`
  - `VITE_SENTRY_TRACES_SAMPLE_RATE` — defaults to `0.1`
  - `VITE_SENTRY_REPLAY=true` — opt-in to 10% on-error replay
- Sensitive URL params (`token`, `access_token`, `apiKey`, etc.) are
  stripped from breadcrumb URLs before send.

**Bundle splitting**

- `plugin-dashboard` (8 component types) now lazy-registered via
  `ComponentRegistry.registerLazy()` — only loads on dashboard pages.
- `plugin-dashboard` and `plugin-report` each get their own chunk
  (previously merged into `plugins-views`).
- Net first-paint JS reduction: **~200 KB** when the user never visits a
  dashboard or report page.
- New chunks: `plugin-dashboard` (119 K), `plugin-report` (92 K),
  `vendor-sentry` (346 K raw / 97 K brotli, lazy).
- `plugins-views` shrinks 387 K → 180 K (now `plugin-list` + `plugin-detail` only).

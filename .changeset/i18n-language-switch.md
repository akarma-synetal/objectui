---
'@object-ui/i18n': minor
'@object-ui/auth': minor
'@object-ui/app-shell': patch
---

Relabel metadata-driven UI on a language switch without a page refresh (#1319)

Switching the UI language left server-resolved metadata labels (object/field/
view labels, action-dialog text) in the old language until a hard refresh,
because renderers cache those labels by object name and never refetch on a
language change.

**`@object-ui/auth`** — `createAuthenticatedFetch` now folds the active
`<html lang>` into `Accept-Language` on API calls (never clobbering an explicit
header), so a switch carries the new locale on every subsequent request.

**`@object-ui/app-shell`** — `ConnectedShellInner` drops the adapter's
locale-blind metadata cache in the render phase and remounts the metadata
subtree via `key={language}`, so every renderer refetches in the new locale.
The adapter and its connection sit above the key and are preserved — an in-app
relabel, not a reconnect.

**`@object-ui/i18n`** — dev-mode missing-key warnings: `createI18n` gains
`warnMissingKeys` (default on outside production) wiring a deduped i18next
`missingKeyHandler`. `useObjectLabel`'s convention-key probes are flagged so
their intentional misses (which fall back to server metadata) stay silent.

Pairs with the framework-side locale-aware metadata changes in
`@objectstack/client` / `@objectstack/objectql` / `@objectstack/rest`.

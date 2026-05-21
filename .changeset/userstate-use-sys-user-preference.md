---
'@object-ui/data-objectstack': minor
'@object-ui/app-shell': minor
---

**Unify per-user UI state storage onto `sys_user_preference`.**

`createObjectStackUserStateAdapter` previously wrote to a bespoke
`user_app_state` object using `(user_id, kind, payload)` columns. That
parallel KV table duplicated the canonical per-user preference store
shipped by `@objectstack/plugin-auth`, and pulled UI traces (favorites,
recent items, grid widths) out of the place users actually look for
their settings.

The adapter now defaults to:

- `resource`: `sys_user_preference`
- field shape: `(user_id, key, value)` instead of `(user_id, kind, payload)`
- option name: **`key`** instead of `kind`

`ConsoleShell` is updated to attach favorites/recent under the namespaced
keys `ui.favorites` and `ui.recent`. Recommended convention for new
adapters: keep machine-written UI traces under `ui.*` so they stay
distinguishable from user-facing preferences (`theme`, `locale`, ...).

**Migration**: callers passing `kind:` need to switch to `key:`. Callers
relying on the old `user_app_state` table can pin
`resource: 'user_app_state'` to keep the legacy behaviour, but no
backend ships that schema and the new default works against any
plugin-auth-enabled environment with zero extra setup.

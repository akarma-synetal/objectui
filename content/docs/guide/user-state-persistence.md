---
title: "User-Scoped State Persistence"
---

Object UI keeps two pieces of per-user UI state — **Favorites** (pinned apps) and **Recent Items** (last visited entities) — alive across reloads, devices, and accounts. The persistence layer is **backend-agnostic**: drop in an adapter, or just let it run on localStorage.

## Design

The shell exposes a small injection contract:

```typescript
export interface UserDataAdapter<T> {
  /** Load the persisted list for the current user. Resolve to [] when absent. */
  load(): Promise<T[]>;
  /** Persist the full list (debounced upstream). Errors are silently ignored. */
  save(items: T[]): Promise<void>;
}

export type UserStateKind = 'favorites' | 'recent';
```

Three layers, top-down:

| Layer | Package | Role |
|---|---|---|
| **Providers** (`FavoritesProvider`, `RecentItemsProvider`) | `@object-ui/app-shell` | Own the state, debounce writes, scope storage by user. |
| **Adapter registry** (`UserStateAdaptersProvider`) | `@object-ui/app-shell` | Lets a bridge component inject adapters at runtime once `dataSource` + `user.id` are available. |
| **Adapters** (`createObjectStackUserStateAdapter`, your own) | `@object-ui/data-objectstack`, custom | Translate `load/save` into HTTP / GraphQL / ObjectQL calls. |

### Three guarantees

1. **localStorage-first.** First paint never blocks on the network. If no adapter is attached, persistence is purely local.
2. **Scoped per `user.id`.** Storage key is `objectui-favorites:u:<id>` (and `objectui-recent-items:u:<id>`). Two accounts on the same browser never see each other's state.
3. **Silent degrade.** Adapters must never throw. A 404 / network error means "behave like there is no backend"; the UI keeps working from localStorage.

## Provider tree

`ConsoleShell` wires everything up in this order:

```tsx
<ThemeProvider>
  <NavigationProvider>
    <UserStateAdaptersProvider>      {/* adapter registry */}
      <FavoritesProvider>            {/* consumes adapter via context */}
        <RecentItemsProvider>
          <Suspense fallback={...}>
            {children /* ConnectedShellInner mounts the bridge */}
          </Suspense>
        </RecentItemsProvider>
      </FavoritesProvider>
    </UserStateAdaptersProvider>
  </NavigationProvider>
</ThemeProvider>
```

`ConnectedShellInner` mounts a tiny `UserStateBridge` component that calls `useAttachUserStateAdapters()` to plug in adapters once both `user.id` and `dataSource` are ready.

## Using the official ObjectStack adapter

The companion adapter is shipped in `@object-ui/data-objectstack`:

```typescript
import { createObjectStackUserStateAdapter } from '@object-ui/data-objectstack';
import { useAttachUserStateAdapters } from '@object-ui/app-shell';
import { useAuth } from '@object-ui/auth';

function UserStateBridge({ dataSource }) {
  const { user } = useAuth();
  const attach = useAttachUserStateAdapters();

  useEffect(() => {
    if (!user?.id || !dataSource) return;
    const favorites = createObjectStackUserStateAdapter({
      dataSource, userId: user.id, kind: 'favorites',
    });
    const recent = createObjectStackUserStateAdapter({
      dataSource, userId: user.id, kind: 'recent',
    });
    attach('favorites', favorites);
    attach('recent', recent);
    return () => {
      attach('favorites', null);
      attach('recent', null);
    };
  }, [user?.id, dataSource, attach]);

  return null;
}
```

### Required backend object

The official adapter stores **one row per (user_id, kind) pair** holding the full list as a JSON blob.

```yaml
object: user_app_state
fields:
  - name: user_id
    type: string
    indexed: true
  - name: kind
    type: string
    indexed: true
  - name: payload
    type: json
  - name: updated_at
    type: datetime
unique: [user_id, kind]
```

If this object doesn't exist on your backend, every call simply 404s — the UI keeps running from localStorage. There is no migration to roll out.

### What the adapter does

1. **load()**
   - `find('user_app_state', { filter: { user_id, kind }, limit: 1 })`
   - Parses `payload` (tolerates already-parsed JSON or string-encoded JSON).
   - Caches the returned row id for fast subsequent saves.
   - Any error → returns `[]`.

2. **save(items)**
   - If we have a cached row id → `update('user_app_state', id, { payload, updated_at })`.
   - Otherwise → `find` then `create`.
   - If update fails (e.g. row was deleted server-side) → falls back to create.
   - Any error → resolves silently.

## Writing a custom adapter

```typescript
import type { UserDataAdapter } from '@object-ui/app-shell';
import type { FavoriteItem } from '@object-ui/app-shell';

export function createMyApiAdapter(userId: string): UserDataAdapter<FavoriteItem> {
  const url = `/api/users/${userId}/favorites`;
  return {
    async load() {
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        return (await res.json()) as FavoriteItem[];
      } catch {
        return [];
      }
    },
    async save(items) {
      try {
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items),
        });
      } catch {
        /* silent */
      }
    },
  };
}
```

Plug it in with `attach('favorites', createMyApiAdapter(user.id))`.

## How writes are batched

The providers debounce backend writes with a 500ms window via `createDebouncedFlush`. A burst of mutations (e.g. drag-reordering ten favorites) results in a single `save()` call carrying the final list. The provider flushes pending writes on unmount and on user-change so nothing is lost during navigation.

`localStorage` is written **synchronously** on every mutation, so reloads always show the latest state immediately even if the debounced backend write hasn't fired yet.

## Race-safety

Each provider keeps a monotonic `hydrationToken`. If the user switches accounts while a `load()` is in flight, the late response is discarded. This prevents seeing User A's favorites flash into User B's session.

## Reference

| Symbol | Package | Description |
|---|---|---|
| `UserStateAdaptersProvider` | `@object-ui/app-shell` | Adapter registry; place above the providers. |
| `useAttachUserStateAdapters()` | `@object-ui/app-shell` | Imperative API for a bridge component to attach/detach adapters. |
| `useUserStateAdapter(kind)` | `@object-ui/app-shell` | Read the currently-attached adapter (rarely needed by app code). |
| `useFavorites()` | `@object-ui/app-shell` | `{ favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite, clearFavorites }` |
| `useRecentItems()` | `@object-ui/app-shell` | `{ recentItems, addRecentItem, clearRecentItems }` |
| `createObjectStackUserStateAdapter(opts)` | `@object-ui/data-objectstack` | Official adapter against the `user_app_state` object. |

## Limits

- **20** favorites per user, **8** recent items. Both enforced by the providers; older entries roll off.
- One JSON blob per (user, kind). Not designed for high-frequency / large payloads — this is UI state, not data.
- No automatic cross-tab sync today (see the roadmap).

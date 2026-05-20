/**
 * ObjectStack-backed `UserDataAdapter` factory.
 *
 * Persists arbitrary per-user UI state (favorites, recently-accessed items, …)
 * as a single JSON blob per `(user_id, kind)` row in an object named
 * `user_app_state`. The single-blob approach keeps round-trips down (one
 * `find` + one `update`/`create` per change) and matches the
 * "save the full list" semantics of `FavoritesProvider` / `RecentItemsProvider`.
 *
 * ## Required object schema
 *
 * Configure an object in ObjectStack with at least the following fields:
 *
 * ```yaml
 * object: user_app_state
 * fields:
 *   user_id:    string   # indexed
 *   kind:       string   # indexed  (e.g. "favorites" | "recent")
 *   payload:    json     # the serialised list
 *   updated_at: datetime # (optional) auto-managed
 * unique: [user_id, kind]
 * ```
 *
 * ## Failure modes
 *
 * The adapter is designed to **degrade silently**. Any error — missing schema,
 * 4xx/5xx, network — is caught:
 *
 * - `load()` returns `[]`, so the hosting provider keeps its localStorage state.
 * - `save()` resolves without throwing, so UI mutations never surface a toast.
 *
 * This means an OSS user who hasn't yet provisioned the `user_app_state`
 * object still gets a perfectly working (localStorage-only) favorites /
 * recent-items experience. As soon as the object exists, persistence
 * "lights up" with no code change.
 *
 * @module
 */

import type { DataSource, QueryParams } from '@object-ui/types';

export interface ObjectStackUserStateAdapterOptions {
  /** Connected data source (usually the one provided by `<AdapterProvider>`). */
  dataSource: DataSource<any>;
  /** Authenticated user id. */
  userId: string;
  /** Logical bucket key, e.g. `"favorites"` or `"recent"`. */
  kind: string;
  /** Override the storage object name. Defaults to `"user_app_state"`. */
  resource?: string;
  /**
   * Optional console logger for development diagnostics. Defaults to noop so
   * production builds stay quiet.
   */
  onError?: (where: 'load' | 'save', error: unknown) => void;
}

export interface UserDataAdapter<T> {
  load(): Promise<T[]>;
  save(items: T[]): Promise<void>;
}

interface UserStateRecord {
  id?: string | number;
  user_id: string;
  kind: string;
  payload: unknown;
  updated_at?: string;
}

const DEFAULT_RESOURCE = 'user_app_state';

/**
 * Build a `UserDataAdapter<T>` backed by ObjectStack.
 *
 * Each adapter instance is bound to a single `(user, kind)` pair; create one
 * per slot you want to persist.
 */
export function createObjectStackUserStateAdapter<T = unknown>(
  options: ObjectStackUserStateAdapterOptions,
): UserDataAdapter<T> {
  const {
    dataSource,
    userId,
    kind,
    resource = DEFAULT_RESOURCE,
    onError = () => {},
  } = options;

  // Cache the row id between load() and save() so we can update in place
  // without re-querying. Reset on every successful load.
  let cachedRowId: string | number | null = null;

  const findExisting = async (): Promise<UserStateRecord | null> => {
    const params: QueryParams = {
      filter: {
        user_id: userId,
        kind,
      },
      limit: 1,
    };
    const result = await dataSource.find(resource, params);
    const rows = (result?.data ?? []) as UserStateRecord[];
    return rows.length > 0 ? rows[0] : null;
  };

  const decodePayload = (payload: unknown): T[] => {
    // The server may return the JSON column already parsed, or as a string.
    if (Array.isArray(payload)) return payload as T[];
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  return {
    async load(): Promise<T[]> {
      try {
        const row = await findExisting();
        if (!row) {
          cachedRowId = null;
          return [];
        }
        if (row.id !== undefined && row.id !== null) cachedRowId = row.id;
        return decodePayload(row.payload);
      } catch (error) {
        onError('load', error);
        return [];
      }
    },

    async save(items: T[]): Promise<void> {
      try {
        const now = new Date().toISOString();
        // Fast path: we already know the row id from a previous load/save.
        if (cachedRowId !== null) {
          try {
            await dataSource.update(resource, cachedRowId, {
              payload: items,
              updated_at: now,
            });
            return;
          } catch (updateError) {
            // Row may have been deleted server-side — fall through to insert.
            cachedRowId = null;
            onError('save', updateError);
          }
        }

        const existing = await findExisting();
        if (existing && existing.id !== undefined && existing.id !== null) {
          cachedRowId = existing.id;
          await dataSource.update(resource, existing.id, {
            payload: items,
            updated_at: now,
          });
          return;
        }

        const created = await dataSource.create(resource, {
          user_id: userId,
          kind,
          payload: items,
          updated_at: now,
        });
        const newId = (created as UserStateRecord | undefined)?.id;
        if (newId !== undefined && newId !== null) cachedRowId = newId;
      } catch (error) {
        onError('save', error);
        // Swallow — provider falls back to localStorage as source of truth.
      }
    },
  };
}

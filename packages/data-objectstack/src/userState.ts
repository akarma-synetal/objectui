/**
 * ObjectStack-backed `UserDataAdapter` factory.
 *
 * Persists arbitrary per-user UI state (favorites, recently-accessed items, …)
 * as a single JSON blob per `(user_id, key)` row in the **unified per-user
 * KV store** — the `sys_user_preference` object shipped by every
 * `@objectstack/plugin-auth`-enabled environment.
 *
 * Using the existing `sys_user_preference` table (rather than a parallel
 * `user_app_state` table) keeps things consistent with the platform's
 * "one KV store per scope" pattern:
 *
 *   - `sys_setting`         ← tenant / env scope
 *   - `sys_user_preference` ← per-user scope  ← we live here
 *
 * Callers are encouraged to namespace their keys (e.g. `ui.favorites`,
 * `ui.recent`, `ui.grid.account.state`) so explicit settings (`theme`,
 * `locale`) and machine-written UI traces stay easy to tell apart.
 *
 * ## Schema this adapter expects
 *
 * The canonical `sys_user_preference` schema (from
 * `@objectstack/platform-objects`):
 *
 * ```yaml
 * object: sys_user_preference
 * fields:
 *   user_id:    lookup(sys_user)  # indexed
 *   key:        string            # indexed  (e.g. "ui.favorites")
 *   value:      json              # the serialised list
 *   updated_at: datetime          # auto-managed
 * unique: [user_id, key]
 * ```
 *
 * ## Failure modes
 *
 * The adapter is designed to **degrade silently**. Any error — missing
 * schema, 4xx/5xx, network — is caught:
 *
 * - `load()` returns `[]`, so the hosting provider keeps its localStorage state.
 * - `save()` resolves without throwing, so UI mutations never surface a toast.
 *
 * As soon as the backend supports `sys_user_preference`, persistence
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
  /**
   * Storage key. Should be a dotted, namespaced string so UI traces
   * don't collide with user-facing preferences. Examples:
   * `ui.favorites`, `ui.recent`, `ui.grid.account.state`.
   */
  key: string;
  /** Override the storage object name. Defaults to `"sys_user_preference"`. */
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

interface UserPreferenceRecord {
  id?: string | number;
  user_id: string;
  key: string;
  value: unknown;
  updated_at?: string;
}

const DEFAULT_RESOURCE = 'sys_user_preference';

/**
 * Build a `UserDataAdapter<T>` backed by ObjectStack.
 *
 * Each adapter instance is bound to a single `(user, key)` pair; create
 * one per slot you want to persist.
 */
export function createObjectStackUserStateAdapter<T = unknown>(
  options: ObjectStackUserStateAdapterOptions,
): UserDataAdapter<T> {
  const {
    dataSource,
    userId,
    key,
    resource = DEFAULT_RESOURCE,
    onError = () => {},
  } = options;

  // Cache the row id between load() and save() so we can update in place
  // without re-querying. Reset on every successful load.
  let cachedRowId: string | number | null = null;

  const findExisting = async (): Promise<UserPreferenceRecord | null> => {
    const params: QueryParams = {
      filter: {
        user_id: userId,
        key,
      },
      limit: 1,
    };
    const result = await dataSource.find(resource, params);
    const rows = (result?.data ?? []) as UserPreferenceRecord[];
    return rows.length > 0 ? rows[0] : null;
  };

  const decodeValue = (value: unknown): T[] => {
    // The server may return the JSON column already parsed, or as a string.
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
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
        return decodeValue(row.value);
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
              value: items,
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
            value: items,
            updated_at: now,
          });
          return;
        }

        const created = await dataSource.create(resource, {
          user_id: userId,
          key,
          value: items,
          updated_at: now,
        });
        const newId = (created as UserPreferenceRecord | undefined)?.id;
        if (newId !== undefined && newId !== null) cachedRowId = newId;
      } catch (error) {
        onError('save', error);
        // Swallow — provider falls back to localStorage as source of truth.
      }
    },
  };
}

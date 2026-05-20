/**
 * FavoritesProvider
 *
 * React Context + Provider for shared favorites state across all consumers
 * (HomePage, AppCard, AppSidebar, UnifiedSidebar, StarredApps).
 *
 * Persistence is **localStorage-first** with optional backend hydration:
 * - On mount we render synchronously from localStorage (no flash of empty UI).
 * - If a `UserDataAdapter<FavoriteItem>` is attached via `UserStateAdaptersProvider`
 *   (see `./UserStateAdapters`), the provider hydrates from the backend and
 *   writes-through every mutation through a debounced `adapter.save()`.
 * - localStorage stays in sync so offline / pre-auth sessions still work and
 *   gives an instant first paint after sign-in.
 * - The local key is scoped per `user.id` so different accounts on the same
 *   browser don't cross-contaminate.
 *
 * @module
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@object-ui/auth';
import {
  createDebouncedFlush,
  scopedKey,
  useUserStateAdapter,
} from './UserStateAdapters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteItem {
  /** Unique key, e.g. "object:contact" or "dashboard:sales_overview" */
  id: string;
  label: string;
  href: string;
  type: 'object' | 'dashboard' | 'page' | 'report';
  /** ISO timestamp of when the item was favorited */
  favoritedAt: string;
}

interface FavoritesContextValue {
  favorites: FavoriteItem[];
  addFavorite: (item: Omit<FavoriteItem, 'favoritedAt'>) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (item: Omit<FavoriteItem, 'favoritedAt'>) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_BASE_KEY = 'objectui-favorites';
const MAX_FAVORITES = 20;

function loadFavorites(userId?: string | null): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_BASE_KEY, userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteItem[], userId?: string | null) {
  try {
    localStorage.setItem(scopedKey(STORAGE_BASE_KEY, userId), JSON.stringify(items));
  } catch {
    // Storage full — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const adapter = useUserStateAdapter<FavoriteItem>('favorites');

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => loadFavorites(userId));

  // Re-load from localStorage whenever the active user changes (sign-in /
  // account switch). Prevents one account from seeing another's favorites.
  useEffect(() => {
    setFavorites(loadFavorites(userId));
  }, [userId]);

  // Hydrate from backend whenever an adapter is attached (or user changes).
  // Backend wins on conflict; we then write through to localStorage so the
  // next reload is instant.
  const hydrationToken = useRef(0);
  useEffect(() => {
    if (!adapter) return;
    const token = ++hydrationToken.current;
    let cancelled = false;
    void (async () => {
      try {
        const remote = await adapter.load();
        if (cancelled || token !== hydrationToken.current) return;
        // Defensive sanitize: drop unparseable shapes, enforce cap.
        const sane = (Array.isArray(remote) ? remote : [])
          .filter(it => it && typeof (it as any).id === 'string')
          .slice(0, MAX_FAVORITES);
        setFavorites(sane);
        saveFavorites(sane, userId);
      } catch {
        // Keep localStorage state — adapter degrade-to-noop is acceptable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, userId]);

  // Debounced write-through to backend.
  const flusher = useMemo(
    () => createDebouncedFlush<FavoriteItem[]>(async items => {
      if (adapter) await adapter.save(items);
    }, 500),
    [adapter],
  );
  // Flush pending writes when the adapter detaches / user changes.
  useEffect(() => () => { void flusher.flush(); }, [flusher]);

  const commit = useCallback(
    (next: FavoriteItem[]) => {
      saveFavorites(next, userId);
      if (adapter) flusher.schedule(next);
    },
    [userId, adapter, flusher],
  );

  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'favoritedAt'>) => {
      setFavorites(prev => {
        if (prev.some(f => f.id === item.id)) return prev;
        const updated = [
          { ...item, favoritedAt: new Date().toISOString() },
          ...prev,
        ].slice(0, MAX_FAVORITES);
        commit(updated);
        return updated;
      });
    },
    [commit],
  );

  const removeFavorite = useCallback(
    (id: string) => {
      setFavorites(prev => {
        const updated = prev.filter(f => f.id !== id);
        commit(updated);
        return updated;
      });
    },
    [commit],
  );

  const toggleFavorite = useCallback(
    (item: Omit<FavoriteItem, 'favoritedAt'>) => {
      setFavorites(prev => {
        const exists = prev.some(f => f.id === item.id);
        const updated = exists
          ? prev.filter(f => f.id !== item.id)
          : [{ ...item, favoritedAt: new Date().toISOString() }, ...prev].slice(
              0,
              MAX_FAVORITES,
            );
        commit(updated);
        return updated;
      });
    },
    [commit],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    commit([]);
  }, [commit]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isFavorite: (id: string) => favorites.some(f => f.id === id),
      clearFavorites,
    }),
    [favorites, addFavorite, removeFavorite, toggleFavorite, clearFavorites],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access shared favorites state.
 *
 * Must be used inside `<FavoritesProvider>`.
 */
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    // Graceful fallback: when a consumer (e.g. AppSidebar) is rendered outside
    // a FavoritesProvider — common in unit tests that only need to assert on
    // navigation rendering — return a no-op implementation rather than crash.
    return {
      favorites: [],
      addFavorite: () => {},
      removeFavorite: () => {},
      toggleFavorite: () => {},
      isFavorite: () => false,
      clearFavorites: () => {},
    };
  }
  return ctx;
}


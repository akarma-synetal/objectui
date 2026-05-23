// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Inspector context — drives the right-side InspectorDrawer.
 *
 * Detail pages (Object Hub, Metadata Viewer, etc.) call
 * `useSetInspectorTarget({ type, name, packageId })` from inside an effect
 * to tell the drawer what resource is currently focused. The drawer then
 * shows API, Source, and Refs tabs for that target.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface InspectorTarget {
  /** Metadata type (e.g. 'object', 'view', 'flow'). */
  type: string;
  /** Metadata name (machine name / table name). */
  name: string;
  /** Owning package id (used for API path display). */
  packageId?: string;
}

interface InspectorContextValue {
  target: InspectorTarget | null;
  open: boolean;
  setTarget: (t: InspectorTarget | null) => void;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function InspectorProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<InspectorTarget | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ target, open, setTarget, setOpen, toggle }),
    [target, open, toggle],
  );

  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}

export function useInspector(): InspectorContextValue {
  const ctx = useContext(InspectorContext);
  if (!ctx) {
    throw new Error('useInspector must be used inside <InspectorProvider>');
  }
  return ctx;
}

/**
 * Tell the Inspector what the user is currently looking at. Call from any
 * detail page; clears on unmount so the drawer can hide its body when the
 * user navigates away.
 */
export function useSetInspectorTarget(target: InspectorTarget | null) {
  const { setTarget } = useInspector();
  useEffect(() => {
    setTarget(target);
    return () => setTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.type, target?.name, target?.packageId]);
}

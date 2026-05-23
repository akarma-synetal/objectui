// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Problems context — lightweight IDE-style validation aggregator.
 *
 * Scans every metadata item and reports cross-reference issues:
 *   - View / Form references a non-existent object
 *   - Hook references a non-existent object
 *   - View field references a field the object doesn't declare
 *
 * Re-runs on demand (Refresh button) and whenever metadata mutates
 * (subscribed via @objectstack/client-react). Counts feed the status bar
 * badge; clicking a problem deep-links to the offending item.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useClient,
  useMetadataSubscriptionCallback,
} from '@objectstack/client-react';

export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  type: string;
  name: string;
  packageId?: string;
  message: string;
  hint?: string;
}

interface ProblemsContextValue {
  problems: Problem[];
  loading: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  refresh: () => Promise<void>;
  lastRun: number | null;
}

const ProblemsContext = createContext<ProblemsContextValue | null>(null);

interface AnyItem {
  name?: string;
  packageId?: string;
  spec?: any;
  [k: string]: any;
}

function isFormSpec(spec: any): boolean {
  return !!(
    spec?.sections ||
    spec?.groups ||
    spec?.type === 'simple' ||
    spec?.type === 'tabbed' ||
    spec?.type === 'wizard' ||
    spec?.viewType === 'form'
  );
}

function collectFieldRefs(spec: any): string[] {
  const out = new Set<string>();
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (typeof n.field === 'string') out.add(n.field);
    if (typeof n.name === 'string' && typeof n.field === 'undefined' && typeof n.type === 'undefined') {
      // forms often use `{ name: 'first_name' }` to reference a field
      // — only treat as a ref if the surrounding object looks like a slot,
      // signaled by having a `label` or `required` sibling.
      if ('label' in n || 'required' in n || 'placeholder' in n) out.add(n.name);
    }
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    for (const k of Object.keys(n)) walk(n[k]);
  };
  walk(spec);
  return [...out];
}

export function ProblemsProvider({ children }: { children: React.ReactNode }) {
  const client = useClient();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const next: Problem[] = [];

      const fetchType = async (t: string): Promise<AnyItem[]> => {
        try {
          const r: any = await client.meta.getItems(t);
          if (Array.isArray(r)) return r;
          if (Array.isArray(r?.items)) return r.items;
          return [];
        } catch {
          return [];
        }
      };

      const [objects, views, hooks, flows] = await Promise.all([
        fetchType('object'),
        fetchType('view'),
        fetchType('hook'),
        fetchType('flow'),
      ]);

      const objByName = new Map<string, any>();
      for (const it of objects) {
        const spec = it?.spec ?? it;
        const n = spec?.name ?? it?.name;
        if (n) objByName.set(n, spec);
      }

      const fieldsOf = (objSpec: any): Set<string> => {
        const out = new Set<string>();
        const fields = objSpec?.fields;
        if (Array.isArray(fields)) {
          for (const f of fields) if (f?.name) out.add(f.name);
        } else if (fields && typeof fields === 'object') {
          for (const k of Object.keys(fields)) out.add(k);
        }
        // Default system fields that ObjectStack injects.
        ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].forEach((f) =>
          out.add(f),
        );
        return out;
      };

      // Check views
      for (const it of views) {
        const spec = it?.spec ?? it;
        const name: string = spec?.name ?? it?.name ?? '?';
        const pkgId: string | undefined = it?.packageId;
        const objRef: string | undefined = spec?.object;
        if (objRef && !objByName.has(objRef)) {
          next.push({
            id: `view:${name}:obj:${objRef}`,
            severity: 'error',
            type: 'view',
            name,
            packageId: pkgId,
            message: `references object "${objRef}" which does not exist`,
            hint: 'Create the object or update the view\u2019s `object` property.',
          });
          continue; // can't field-check without the object
        }
        if (objRef && isFormSpec(spec)) {
          const fields = fieldsOf(objByName.get(objRef));
          const refs = collectFieldRefs(spec);
          for (const f of refs) {
            if (!fields.has(f)) {
              next.push({
                id: `view:${name}:fld:${f}`,
                severity: 'warning',
                type: 'view',
                name,
                packageId: pkgId,
                message: `references field "${f}" not declared on "${objRef}"`,
                hint: 'Did you rename the field? Update the form to match.',
              });
            }
          }
        }
      }

      // Check hooks
      for (const it of hooks) {
        const spec = it?.spec ?? it;
        const name: string = spec?.name ?? it?.name ?? '?';
        const pkgId: string | undefined = it?.packageId;
        const objRef: string | undefined = spec?.object;
        if (objRef && !objByName.has(objRef)) {
          next.push({
            id: `hook:${name}:obj:${objRef}`,
            severity: 'error',
            type: 'hook',
            name,
            packageId: pkgId,
            message: `hook references object "${objRef}" which does not exist`,
          });
        }
      }

      // Check flows (trigger.object)
      for (const it of flows) {
        const spec = it?.spec ?? it;
        const name: string = spec?.name ?? it?.name ?? '?';
        const pkgId: string | undefined = it?.packageId;
        const objRef: string | undefined = spec?.trigger?.object;
        if (objRef && !objByName.has(objRef)) {
          next.push({
            id: `flow:${name}:obj:${objRef}`,
            severity: 'warning',
            type: 'flow',
            name,
            packageId: pkgId,
            message: `flow trigger references object "${objRef}" which does not exist`,
          });
        }
      }

      setProblems(next);
      setLastRun(Date.now());
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Initial load + re-load when metadata mutates.
  useEffect(() => {
    refresh();
  }, [refresh]);

  useMetadataSubscriptionCallback('object', () => {
    refresh();
  });
  useMetadataSubscriptionCallback('view', () => {
    refresh();
  });
  useMetadataSubscriptionCallback('flow', () => {
    refresh();
  });
  useMetadataSubscriptionCallback('hook', () => {
    refresh();
  });

  const value = useMemo(
    () => ({ problems, loading, open, setOpen, toggle, refresh, lastRun }),
    [problems, loading, open, toggle, refresh, lastRun],
  );

  return <ProblemsContext.Provider value={value}>{children}</ProblemsContext.Provider>;
}

export function useProblems(): ProblemsContextValue {
  const ctx = useContext(ProblemsContext);
  if (!ctx) throw new Error('useProblems must be used inside <ProblemsProvider>');
  return ctx;
}

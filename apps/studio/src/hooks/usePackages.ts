// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * usePackages — flat replacement for the deleted useEnvAwarePackages hook.
 *
 * Studio is a single-project metadata browser; package discovery is a
 * straight call to `client.packages.list()` (=> `GET /api/v1/packages`).
 * No project/env scoping, no last-used localStorage caching, no MSW kernel
 * fallback — just whatever the connected backend currently has installed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InstalledPackage } from '@objectstack/spec/kernel';
import { useClient } from '@objectstack/client-react';

export interface UsePackagesResult {
  packages: InstalledPackage[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  selectedPackage: InstalledPackage | null;
  setSelectedPackage: (pkg: InstalledPackage | null) => void;
}

export function usePackages(activePackageId?: string | null): UsePackagesResult {
  const client = useClient() as any;
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<InstalledPackage | null>(null);

  const reload = useCallback(async () => {
    if (!client?.packages?.list) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.packages.list();
      const list: InstalledPackage[] = Array.isArray(result)
        ? result
        : (result?.packages ?? result?.items ?? []);
      setPackages(list);
    } catch (err) {
      setError(err as Error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Resolve the URL package segment against the loaded list.
  useEffect(() => {
    if (!activePackageId) {
      if (selectedPackage) setSelectedPackage(null);
      return;
    }
    if (!packages.length) return;
    const match = packages.find(
      (p) =>
        p.manifest?.id === activePackageId ||
        p.manifest?.id?.split('.').pop() === activePackageId,
    );
    if (match && match !== selectedPackage) setSelectedPackage(match);
  }, [activePackageId, packages, selectedPackage]);

  return useMemo(
    () => ({ packages, loading, error, reload, selectedPackage, setSelectedPackage }),
    [packages, loading, error, reload, selectedPackage],
  );
}

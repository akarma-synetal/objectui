// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /$package — package workspace.
 *
 * Renders the metadata sidebar (kept in sync with the URL's $package
 * segment via {@link usePackages}) and the `<Outlet />` for child routes:
 *   - `/$package`                       → package overview
 *   - `/$package/metadata/$type/$name`  → metadata viewer (PluginHost)
 *   - `/$package/objects/$name`         → object viewer (PluginHost)
 */

import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { usePackages } from '@/hooks/usePackages';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

function PackageLayoutComponent() {
  const { package: packageId } = useParams({ from: '/$package' });
  const navigate = useNavigate();
  const { packages, selectedPackage } = usePackages(packageId);

  const handleSelectPackage = useCallback(
    (pkg: InstalledPackage) => {
      const nextId = pkg.manifest?.id;
      if (!nextId) return;
      navigate({ to: '/$package', params: { package: nextId } });
    },
    [navigate],
  );

  return (
    <>
      <AppSidebar
        packages={packages}
        selectedPackage={selectedPackage}
        onSelectPackage={handleSelectPackage}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <Outlet />
      </main>
    </>
  );
}

export const Route = createFileRoute('/$package')({ component: PackageLayoutComponent });

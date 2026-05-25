// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DeveloperOverview } from '../components/DeveloperOverview';
import { usePackages } from '../hooks/usePackages';

function PackageIndexComponent() {
  const { package: packageId } = Route.useParams();
  const { packages, selectedPackage } = usePackages(packageId);
  const navigate = useNavigate();

  const onNavigate = (view: string, detail?: string) => {
    // Map common overview links → existing studio routes. Anything we
    // don't have a dedicated page for (e.g. "packages") just stays put.
    const safePackage = packageId;
    // Recent-items uses "metadata:{type}" to navigate to a non-object
    // metadata item (views, forms, flows, agents, …). The destination
    // is the unified metadata viewer route.
    if (view.startsWith('metadata:') && detail) {
      const type = view.slice('metadata:'.length);
      navigate({
        to: '/$package/metadata/$type/$name',
        params: { package: safePackage, type, name: detail },
      });
      return;
    }
    switch (view) {
      case 'home':
      case 'overview':
        navigate({ to: '/$package', params: { package: safePackage } });
        return;
      case 'objects':
        navigate({ to: '/$package/objects', params: { package: safePackage } });
        return;
      case 'object':
        if (detail)
          navigate({
            to: '/$package/objects/$name',
            params: { package: safePackage, name: detail },
          });
        return;
      case 'views':
      case 'apps':
      case 'forms':
      case 'automations':
      case 'ai':
      case 'security':
      case 'apis':
      case 'playground':
      case 'logs':
        navigate({ to: `/$package/${view}` as any, params: { package: safePackage } });
        return;
      default:
        // Unknown destination — no-op rather than 404.
        return;
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DeveloperOverview
        packages={packages}
        selectedPackage={selectedPackage}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export const Route = createFileRoute('/$package/')({
  component: PackageIndexComponent,
});

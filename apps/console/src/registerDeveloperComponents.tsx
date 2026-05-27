// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Developer component registrations.
 *
 * Binds the `developer:*` registry keys (referenced from the framework's
 * default developer navigation group) to the lazy-loaded console pages
 * that already host these tools.
 *
 * URL shape resolved by `ComponentNavView`:
 *   developer:api-console  → /apps/<app>/component/developer/api-console
 *   developer:flow-runs    → /apps/<app>/component/developer/flow-runs
 *   developer:public-forms → /apps/<app>/component/developer/public-forms
 *
 * The existing standalone `/developer/*` routes in `AppContent.tsx` are
 * left in place — they remain reachable from the Console-shell Developer
 * Hub. This module only wires the metadata-driven entry from app sidebars.
 */

import { lazy, Suspense } from 'react';
import { registerAppComponent } from '@object-ui/app-shell';

const ApiConsolePage = lazy(() =>
  import('./pages/developer/ApiConsolePage').then((m) => ({ default: m.ApiConsolePage })),
);
const FlowRunsPage = lazy(() =>
  import('./pages/developer/FlowRunsPage').then((m) => ({ default: m.FlowRunsPage })),
);
const PublicFormsPage = lazy(() =>
  import('./pages/developer/PublicFormsPage').then((m) => ({ default: m.PublicFormsPage })),
);

function DeveloperFallback({ label }: { label: string }) {
  return <div className="p-6 text-sm text-muted-foreground">Loading {label}…</div>;
}

registerAppComponent({
  ref: 'developer:api-console',
  label: 'API Console',
  source: '@objectstack/console',
  component: (props: any) => (
    <Suspense fallback={<DeveloperFallback label="API console" />}>
      <ApiConsolePage {...props} />
    </Suspense>
  ),
});

registerAppComponent({
  ref: 'developer:flow-runs',
  label: 'Flow Runs',
  source: '@objectstack/console',
  component: (props: any) => (
    <Suspense fallback={<DeveloperFallback label="flow runs" />}>
      <FlowRunsPage {...props} />
    </Suspense>
  ),
});

registerAppComponent({
  ref: 'developer:public-forms',
  label: 'Public Forms',
  source: '@objectstack/console',
  component: (props: any) => (
    <Suspense fallback={<DeveloperFallback label="public forms" />}>
      <PublicFormsPage {...props} />
    </Suspense>
  ),
});

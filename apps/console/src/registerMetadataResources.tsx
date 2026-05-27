// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata resource registrations for the Console host.
 *
 * The metadata-admin engine in `@object-ui/app-shell` drives every metadata
 * type generically (JSONSchema-driven list + form), but specialised editors
 * can opt in by registering a per-type override here.
 *
 * Currently registered:
 *   - `object` → ObjectManager from `@object-ui/plugin-designer` (rich
 *     visual designer; replaces the generic ListPage so authors keep the
 *     drag-and-drop field experience instead of a flat JSONSchema form).
 */

import { lazy, Suspense } from 'react';
import { registerMetadataResource } from '@object-ui/app-shell';

const ObjectManagerListPage = lazy(() =>
  import('./components/ObjectManagerListPage').then((m) => ({
    default: m.ObjectManagerListPage,
  })),
);

registerMetadataResource({
  type: 'object',
  ListPage: (props) => (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading Object Manager…</div>
      }
    >
      <ObjectManagerListPage {...props} />
    </Suspense>
  ),
});

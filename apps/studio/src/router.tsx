// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Route Tree Configuration
 *
 * TanStack Router auto-generates this file from routes/ directory.
 * This import is required for the router to work.
 */

import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NotFoundPage } from './components/NotFoundPage';

/**
 * Compute the router basepath at runtime from `document.baseURI`.
 *
 * The published Studio build uses a relative Vite base (`./`) so the same
 * `dist/` can be mounted under any path. Hosts that embed the SPA inject
 * a `<base href="/path/">` tag into the served HTML (the framework CLI
 * does this automatically); standalone / dev runs fall back to `/`.
 *
 * TanStack Router expects the basepath WITHOUT a trailing slash (except
 * for the root `'/'`), so we normalise accordingly.
 */
function resolveBasepath(): string {
  try {
    if (typeof document === 'undefined') return '/';
    const url = new URL(document.baseURI);
    const path = url.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return '/';
  }
}

export const router = createRouter({
  routeTree,
  basepath: resolveBasepath(),
  defaultNotFoundComponent: () => {
    // Try to recover the current package id from the URL so the "home"
    // button can land back where the user was working instead of dumping
    // them at the global Studio root.
    const base = resolveBasepath();
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const stripped = base !== '/' && path.startsWith(base) ? path.slice(base.length) : path;
    const segments = stripped.split('/').filter(Boolean);
    const packageId = segments[0] && segments[0].includes('.') ? segments[0] : undefined;
    return <NotFoundPage packageId={packageId} />;
  },
});

// Register things for type-safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Link } from '@tanstack/react-router';
import { Compass, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Friendly 404 surface. Replaces the default TanStack Router fallback
 * (a bare "Not Found" string) with something usable.
 *
 * If we know which package the user was in, offer a one-click jump back
 * to its Home; otherwise just send them to the Studio root.
 */
export function NotFoundPage({ packageId }: { packageId?: string }) {
  const homeHref = packageId ? `/${packageId}` : '/';

  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Compass className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          The URL you opened doesn’t match anything in Studio. It may have
          moved, been removed, or simply mistyped.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
          <Button asChild size="sm">
            <Link to={homeHref}>
              <Home className="mr-2 h-4 w-4" />
              {packageId ? 'Package home' : 'Studio home'}
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Tip: press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> to jump to anything.
        </p>
      </div>
    </div>
  );
}

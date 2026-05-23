// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Welcome / onboarding card shown on Home when the active package has no
 * user-authored metadata yet. Mimics Hasura Console / Supabase Studio's
 * first-run experience: three big actionable cards that bootstrap a
 * developer into a real project flow.
 */

import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Wand2, BookOpen, Sparkles } from 'lucide-react';

interface WelcomeOnboardingProps {
  packageId: string;
}

export function WelcomeOnboarding({ packageId }: WelcomeOnboardingProps) {
  return (
    <div className="flex flex-1 items-start justify-center p-4 md:p-8 overflow-auto">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Studio
          </h1>
          <p className="text-sm text-muted-foreground max-w-prose mx-auto">
            This package looks empty. Pick a starting point — every option
            below produces real metadata you can edit, preview, and deploy.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader>
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center mb-2">
                <Database className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Create your first object</CardTitle>
              <CardDescription>
                Start with a table. Add fields, relations, validations.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full" size="sm">
                <Link
                  to="/$package/objects"
                  params={{ package: packageId }}
                >
                  New object
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center mb-2">
                <Wand2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Try the Playground</CardTitle>
              <CardDescription>
                Issue REST / ObjectQL calls and preview forms live.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full" size="sm">
                <Link
                  to="/$package/playground"
                  params={{ package: packageId }}
                >
                  Open Playground
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center mb-2">
                <BookOpen className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Browse examples</CardTitle>
              <CardDescription>
                Read defineStack() recipes for todo, CRM, and BI apps.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full" size="sm">
                <a
                  href="/docs/getting-started"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open docs
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Tip — press <kbd className="px-1.5 py-0.5 rounded bg-muted">?</kbd> to see
          all keyboard shortcuts. Press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted">⌘K</kbd> for the command palette.
        </div>
      </div>
    </div>
  );
}

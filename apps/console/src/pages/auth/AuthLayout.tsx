/**
 * AuthLayout — minimal shared shell for every unauthenticated Console
 * surface (login, register, forgot-password, reset-password, verify-email,
 * setup, oauth/consent, auth/device, accept-invitation).
 *
 *   ┌─────────────────────────────────────────┐
 *   │                                         │
 *   │          centred form card              │
 *   │                                         │
 *   └─────────────────────────────────────────┘
 *
 * Deliberately brand-agnostic — ObjectStack is a developer tool and
 * downstream operators don't want a vendor wordmark on every customer-
 * facing auth page. A small host pill is shown when the page renders on
 * what looks like a tenant subdomain so a user bouncing through an SSO
 * redirect can still tell which workspace they're signing in to.
 *
 * Mirrors `framework/apps/account/src/components/auth/auth-shell.tsx` so
 * the Console-hosted auth pages look identical to the legacy Account SPA.
 */

import { useEffect, type ReactNode } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { cn } from '@object-ui/components';

export interface AuthLayoutProps {
  children: ReactNode;
  /** Optional max-width on the form container (default `sm`). */
  formWidth?: 'sm' | 'md';
}

function isCanonicalCloudHost(host: string): boolean {
  const bare = host.split(':')[0]!.toLowerCase();
  return /^cloud\./.test(bare);
}

function currentHost(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.host || null;
}

export function AuthLayout({ children, formWidth = 'sm' }: AuthLayoutProps) {
  const { t } = useObjectTranslation();
  const widthCls = formWidth === 'md' ? 'max-w-md' : 'max-w-sm';

  const host = currentHost();
  const showHostPill = !!host && !isCanonicalCloudHost(host);

  useEffect(() => {
    if (typeof document === 'undefined' || !host) return;
    const original = document.title;
    if (showHostPill) document.title = host;
    return () => {
      document.title = original;
    };
  }, [host, showHostPill]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted p-6">
      <div className={cn('flex w-full flex-col gap-4', widthCls)}>
        {showHostPill ? (
          <div className="flex justify-center">
            <span
              className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              title={t('auth.shell.tenantHostHint', {
                defaultValue: 'You are signing in to this workspace',
              })}
            >
              {host}
            </span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

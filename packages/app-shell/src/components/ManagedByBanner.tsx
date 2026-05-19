import { ShieldAlert } from 'lucide-react';

/**
 * ManagedByBanner — surface a warning when the user is viewing an object
 * whose schema is owned by an upstream system (e.g. `better-auth`).
 *
 * Why this exists
 * ───────────────
 * The platform delegates a swath of identity tables (`sys_user`,
 * `sys_session`, `sys_account`, `sys_oauth_*`, `sys_jwks`, …) to
 * better-auth. The ObjectStack schema layer marks them with
 * `managedBy: 'better-auth'` so:
 *
 *   1. Migrations don't drop or re-shape them.
 *   2. The platform plugins (approvals, sharing) know they're read via
 *      a third-party contract.
 *
 * But the Console still lets a curious admin click "New" or "Edit" on
 * any of them. A direct write through the generic data API *will* hit
 * the database, **bypassing better-auth's password hashing, session
 * validation, two-factor checks, audit hooks** — silent data corruption.
 *
 * This banner is a UI-layer guard. It tells the user the table is
 * externally managed and links them to the canonical workflow (e.g.
 * the auth UI for password resets). Form components additionally read
 * `managedBy` and disable inputs by default.
 *
 * The check is intentionally simple: any `managedBy` value other than
 * `'platform'` (or `undefined`) triggers the banner. Future managed
 * systems (workOS / Auth0 / Okta integrations) get the same protection
 * for free.
 */
export interface ManagedByBannerProps {
  /**
   * The `managedBy` flag from the object schema. Treated as
   * platform-owned (no banner) when `undefined` or `'platform'`.
   */
  managedBy?: string;
  /**
   * Optional override for the human-readable system name. Defaults to
   * the value of `managedBy`.
   */
  label?: string;
  /**
   * Optional documentation link rendered as "Learn more →".
   */
  docHref?: string;
}

export function ManagedByBanner({ managedBy, label, docHref }: ManagedByBannerProps) {
  if (!managedBy || managedBy === 'platform') return null;
  const display = label ?? managedBy;
  return (
    <div
      role="alert"
      data-testid="managed-by-banner"
      className="flex items-start gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" />
      <div className="flex-1">
        <strong className="font-semibold">Managed by {display}.</strong>{' '}
        This object's schema is owned by an upstream system. Direct edits here
        bypass {display}'s validation, hashing, and audit logic — and may
        corrupt account state. Use the {display} admin flow for changes.
        {docHref && (
          <>
            {' '}
            <a
              href={docHref}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
            >
              Learn more →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

import { ShieldAlert, Info, Lock, Archive } from 'lucide-react';

/**
 * ManagedByBanner — surface a context-appropriate notice at the top of
 * any list/detail/form page whose object isn't a plain user-owned table.
 *
 * The platform tags every system object with `managedBy` (see
 * `@objectstack/spec/data/object.zod.ts`). The five buckets get five
 * different presentations:
 *
 *   - `platform`     — User-owned business data. **No banner.**
 *   - `config`       — Admin-authored configuration (approval processes,
 *                      sharing rules, roles, permission sets, views,
 *                      apps). Informational banner: "Authored by
 *                      administrators. Author here, runtime data lives
 *                      elsewhere."
 *   - `system`       — Engine-managed runtime rows (approval requests,
 *                      record shares, notifications, invitations).
 *                      Lockdown banner: "Created and updated by the
 *                      platform — use the source record's action button
 *                      to create new entries."
 *   - `append-only`  — Audit log (approval actions, audit log, activity,
 *                      email log, presence). Archive banner: "Read-only
 *                      historical record. Use Export to download."
 *   - `better-auth`  — Identity tables owned by better-auth. Warning
 *                      banner: "Direct edits bypass password hashing /
 *                      session validation / audit hooks."
 *
 * Forms additionally read `managedBy` and disable inputs when not
 * `'platform'`, and ObjectView gates the New / Import buttons via
 * `resolveCrudAffordances()`. This component just explains *why*.
 */

type Bucket = 'platform' | 'config' | 'system' | 'append-only' | 'better-auth';

export interface ManagedByBannerProps {
  /** The `managedBy` flag from the object schema. */
  managedBy?: string;
  /** Optional override for the human-readable system name. */
  label?: string;
  /** Optional documentation link rendered as "Learn more →". */
  docHref?: string;
  /**
   * Optional human-readable name for the source record / parent workflow
   * referenced in `system`-bucket banners (e.g. "Opportunity"). When
   * provided the banner reads "Use the Opportunity record's Submit for
   * Approval action…" instead of the generic phrasing.
   */
  sourceRecordLabel?: string;
}

interface Variant {
  icon: typeof ShieldAlert;
  tone: string; // tailwind utility classes
  title: string;
  body: (display: string, sourceRecordLabel?: string) => string;
}

const VARIANTS: Record<Exclude<Bucket, 'platform'>, Variant> = {
  config: {
    icon: Info,
    tone: 'border-sky-300/60 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-100',
    title: 'Administrator configuration',
    body: () =>
      "These rows define how the platform behaves at runtime — they're authored here, but the runtime data they produce lives in a separate table. Changes take effect once a row is marked Active.",
  },
  system: {
    icon: Lock,
    tone: 'border-slate-300/60 bg-slate-50 text-slate-900 dark:border-slate-500/40 dark:bg-slate-950/40 dark:text-slate-100',
    title: 'Managed by the platform',
    body: (_display, src) =>
      `Rows here are created and updated automatically by the platform engine. To start a new one, use the action button on the ${src ?? 'source record'} (e.g. "Submit for Approval", "Share", "Invite"). The list below is the audit / monitoring surface — actions like Approve, Recall, or Resend live on the row.`,
  },
  'append-only': {
    icon: Archive,
    tone: 'border-zinc-300/60 bg-zinc-50 text-zinc-900 dark:border-zinc-500/40 dark:bg-zinc-950/40 dark:text-zinc-100',
    title: 'Read-only historical record',
    body: () =>
      "This is an immutable audit log. Rows cannot be created, edited, or deleted from the UI — they're written by the platform when events occur. Use Export to download for compliance review.",
  },
  'better-auth': {
    icon: ShieldAlert,
    tone: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
    title: 'Managed by better-auth',
    body: (display) =>
      `This object's schema is owned by ${display}. Direct edits here bypass password hashing, session validation, two-factor checks, and audit hooks — and may corrupt account state. Use the dedicated identity workflows instead (Invite User, Reset Password, Revoke Session, Rotate Key, …).`,
  },
};

export function ManagedByBanner({ managedBy, label, docHref, sourceRecordLabel }: ManagedByBannerProps) {
  if (!managedBy || managedBy === 'platform') return null;
  const variant = VARIANTS[managedBy as Exclude<Bucket, 'platform'>];
  if (!variant) return null;
  const display = label ?? managedBy;
  const Icon = variant.icon;
  return (
    <div
      role="note"
      data-testid="managed-by-banner"
      data-bucket={managedBy}
      className={`flex items-start gap-3 border-b px-4 py-2.5 text-sm ${variant.tone}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-none" />
      <div className="flex-1">
        <strong className="font-semibold">{variant.title}.</strong>{' '}
        {variant.body(display, sourceRecordLabel)}
        {docHref && (
          <>
            {' '}
            <a
              href={docHref}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
            >
              Learn more →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

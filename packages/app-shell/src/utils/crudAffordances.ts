/**
 * crudAffordances — UI-side mirror of the framework's
 * `resolveCrudAffordances()` helper (see
 * `@objectstack/spec/data/object.zod.ts`).
 *
 * The framework tags every object with a `managedBy` lifecycle bucket
 * (`platform | config | system | append-only | better-auth`) and an
 * optional `userActions` override block. UI components ask this helper
 * "should I show the New / Import / Edit / Delete / Export buttons?" so
 * the toolbar tracks the object's lifecycle automatically — no need for
 * each view to special-case `sys_*` names.
 *
 * Keep this in lockstep with the framework helper. The bucket defaults
 * mirror what Salesforce / ServiceNow / Workday / Notion do for the
 * equivalent categories of system tables.
 */

export type ManagedByBucket =
  | 'platform'
  | 'config'
  | 'system'
  | 'append-only'
  | 'better-auth';

export interface CrudAffordances {
  /** Generic "New" button for single-record creation. */
  create: boolean;
  /** CSV bulk-import wizard. */
  import: boolean;
  /** Inline + form editing of existing rows. */
  edit: boolean;
  /** Row-level + bulk delete. */
  delete: boolean;
  /** CSV / clipboard export. */
  exportCsv: boolean;
}

export interface UserActionsOverride {
  create?: boolean;
  import?: boolean;
  edit?: boolean;
  delete?: boolean;
  exportCsv?: boolean;
}

const DEFAULTS: Record<ManagedByBucket, CrudAffordances> = {
  platform:      { create: true,  import: true,  edit: true,  delete: true,  exportCsv: true },
  config:        { create: true,  import: false, edit: true,  delete: true,  exportCsv: true },
  system:        { create: false, import: false, edit: false, delete: false, exportCsv: true },
  'append-only': { create: false, import: false, edit: false, delete: false, exportCsv: true },
  'better-auth': { create: false, import: false, edit: false, delete: false, exportCsv: true },
};

export interface SchemaLike {
  managedBy?: string | null;
  userActions?: UserActionsOverride | null;
}

export function resolveCrudAffordances(obj: SchemaLike | null | undefined): CrudAffordances {
  const bucket = (obj?.managedBy as ManagedByBucket | undefined) ?? 'platform';
  const base = DEFAULTS[bucket] ?? DEFAULTS.platform;
  const o = obj?.userActions ?? {};
  return {
    create:    o.create    ?? base.create,
    import:    o.import    ?? base.import,
    edit:      o.edit      ?? base.edit,
    delete:    o.delete    ?? base.delete,
    exportCsv: o.exportCsv ?? base.exportCsv,
  };
}

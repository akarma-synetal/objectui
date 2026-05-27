// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in component registrations — Phase 3b + 3c.
 *
 * Side-effect module imported by `index.ts` to ensure the platform's
 * own admin UI is registered with the ComponentRegistry before
 * AppContent mounts the first `<Route path="component/...">`.
 *
 * Plugins follow the same pattern: their package entry point imports
 * a similar registration module, so `import '@object-ui/plugin-foo'`
 * is enough to make the plugin's component refs reachable from app
 * metadata.
 *
 * Phase 3c — also registers the new generic metadata admin engine and
 * pre-wires specialised editors for `object` and `field` so admins
 * still get the polished ObjectManager / FieldDesigner experience
 * inside the unified Setup-app shell.
 */

import { lazy, Suspense } from 'react';
import { registerAppComponent } from './componentRegistry';
import {
  MetadataDirectoryPage,
  MetadataResourceRouter,
  registerMetadataResource,
} from '../views/metadata-admin';
import { PermissionMatrixEditPage } from '../views/metadata-admin/PermissionMatrixEditor';
import { DesignerEditorWrapper } from '../views/metadata-admin/DesignerEditorWrapper';

/* -------------------------------------------------------------------------- */
/* 1) Top-level admin pages — bound to `metadata:directory` + `metadata:resource` */
/* -------------------------------------------------------------------------- */

registerAppComponent({
  ref: 'metadata:directory',
  label: 'All Metadata Types',
  source: '@object-ui/app-shell',
  component: MetadataDirectoryPage,
});

registerAppComponent({
  ref: 'metadata:resource',
  label: 'Metadata Resource',
  source: '@object-ui/app-shell',
  // The router switches between list / new / edit / history based on
  // the sub-path under `/component/metadata/resource/...`.
  component: MetadataResourceRouter,
});

/* -------------------------------------------------------------------------- */
/* 2) Specialised editors for flagship types — opt the generic engine        */
/*    out for the types that already have polished bespoke surfaces.         */
/*                                                                            */
/*    Note: `object` and `field` intentionally use the generic engine so the */
/*    Metadata Directory has a consistent list/edit experience across every  */
/*    type (only `permission`, `view`, `dashboard`, `page` keep bespoke      */
/*    editors below — those are visual designers, not list/form pages).      */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'object',
  label: 'Objects',
  description: 'Domain entities — tables in the data model. Each object owns its fields, relationships, validations, and lifecycle hooks.',
  domain: 'data',
  searchableFields: ['name', 'label', 'description'],
  listColumns: [
    { key: 'name', label: 'Name', width: '25%' },
    { key: 'label', label: 'Label', width: '25%' },
    { key: 'description', label: 'Description' },
  ],
});

registerMetadataResource({
  type: 'field',
  label: 'Fields',
  description: 'Columns attached to objects — name, type, validation, and storage settings.',
  domain: 'data',
  searchableFields: ['name', 'label', 'object', 'type'],
  listColumns: [
    { key: 'name', label: 'Name', width: '25%' },
    { key: 'object', label: 'Object', width: '20%' },
    { key: 'type', label: 'Type', width: '15%' },
    { key: 'label', label: 'Label' },
  ],
});

/* -------------------------------------------------------------------------- */
/* 3) Permission matrix editor — replaces the generic AutoForm for           */
/*    `type=permission` with a Salesforce-style grid (Phase 3e).             */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'permission',
  label: 'Permission sets',
  description: 'Object-level CRUD + VAMA + lifecycle permissions, and field-level R/W. Profiles are permission sets with isProfile=true.',
  domain: 'security',
  EditPage: PermissionMatrixEditPage,
  searchableFields: ['name', 'label'],
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    {
      key: 'isProfile',
      label: 'Type',
      width: '15%',
      render: (v) => (v ? 'Profile' : 'Permission set'),
    },
  ],
});

/* -------------------------------------------------------------------------- */
/* 4) Bespoke designers wired through DesignerEditorWrapper (Phase 3d).      */
/*    These types continue to use the generic AutoForm-style list and        */
/*    history pages but swap the edit page for the existing visual designer. */
/* -------------------------------------------------------------------------- */

const ObjectViewConfigurator = lazy(() =>
  import('@object-ui/plugin-designer').then((m) => ({ default: m.ObjectViewConfigurator })),
);
const DashboardEditor = lazy(() =>
  import('@object-ui/plugin-designer').then((m) => ({ default: m.DashboardEditor })),
);
const PageCanvasEditor = lazy(() =>
  import('@object-ui/plugin-designer').then((m) => ({ default: m.PageCanvasEditor })),
);

function ViewEditPage(props: { type: string; name: string }) {
  return (
    <DesignerEditorWrapper
      {...props}
      fromMetadata={(raw: any) => {
        // Normalize backend view metadata into the shape ObjectViewConfigurator expects.
        // Built-in views may omit `columns` or use legacy field names.
        const base = raw && typeof raw === 'object' ? raw : {};
        return {
          viewType: base.viewType ?? base.type ?? 'grid',
          columns: Array.isArray(base.columns) ? base.columns : [],
          filters: Array.isArray(base.filters) ? base.filters : [],
          sorts: Array.isArray(base.sorts) ? base.sorts : [],
          pageSize: typeof base.pageSize === 'number' ? base.pageSize : 25,
          ...base,
        };
      }}
      renderDesigner={(value, onChange, readOnly) => (
        <Suspense fallback={<DesignerFallback label="view designer" />}>
          <ObjectViewConfigurator
            config={value as any}
            onChange={(next) => onChange(next as any)}
            readOnly={readOnly}
          />
        </Suspense>
      )}
    />
  );
}

function DashboardEditPage(props: { type: string; name: string }) {
  return (
    <DesignerEditorWrapper
      {...props}
      renderDesigner={(value, onChange, readOnly) => (
        <Suspense fallback={<DesignerFallback label="dashboard editor" />}>
          <DashboardEditor
            schema={value as any}
            onChange={(next: any) => onChange(next)}
            readOnly={readOnly}
          />
        </Suspense>
      )}
    />
  );
}

function PageEditPage(props: { type: string; name: string }) {
  return (
    <DesignerEditorWrapper
      {...props}
      renderDesigner={(value: any, onChange, readOnly) => (
        <Suspense fallback={<DesignerFallback label="page canvas" />}>
          <PageCanvasEditor
            schema={value as any}
            onChange={(next: any) => onChange(next)}
            readOnly={readOnly}
          />
        </Suspense>
      )}
    />
  );
}

function DesignerFallback({ label }: { label: string }) {
  return (
    <div className="p-6 text-sm text-muted-foreground">Loading {label}…</div>
  );
}

registerMetadataResource({
  type: 'view',
  label: 'Views',
  description: 'Saved list / kanban / calendar / gantt configurations on top of an object.',
  domain: 'ui',
  EditPage: ViewEditPage,
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'object', label: 'Object', width: '20%' },
    { key: 'type', label: 'Type', width: '15%' },
    { key: 'label', label: 'Label' },
  ],
});

registerMetadataResource({
  type: 'dashboard',
  label: 'Dashboards',
  description: 'Composed dashboards with charts, KPIs, and tables.',
  domain: 'ui',
  EditPage: DashboardEditPage,
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'description', label: 'Description' },
  ],
});

registerMetadataResource({
  type: 'page',
  label: 'Pages',
  description: 'Visual page layouts authored in the Page Canvas editor.',
  domain: 'ui',
  EditPage: PageEditPage,
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'route', label: 'Route' },
  ],
});

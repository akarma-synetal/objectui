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

import { lazy } from 'react';
import { registerAppComponent } from './componentRegistry';
import {
  MetadataDirectoryPage,
  MetadataResourceRouter,
  registerMetadataResource,
  useMetadataClient,
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
/* -------------------------------------------------------------------------- */

// Lazy so the heavy designer bundle isn't pulled in when the admin
// only navigates to lighter types (e.g. flow, view).
const MetadataObjectsPage = lazy(() =>
  import('@object-ui/plugin-designer').then((m) => ({ default: m.MetadataObjectsPage })),
);
const MetadataFieldsPage = lazy(() =>
  import('@object-ui/plugin-designer').then((m) => ({ default: m.MetadataFieldsPage })),
);

function ObjectListWrapper() {
  const client = useMetadataClient();
  return <MetadataObjectsPage client={client} hideSystemObjects={false} />;
}

function ObjectEditWrapper({ name }: { type: string; name: string }) {
  // Editing an object = managing its fields. Hop straight into the
  // FieldDesigner shell scoped to this object's name.
  const client = useMetadataClient();
  return (
    <div className="p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading fields…</div>}>
        <MetadataFieldsPage client={client} objectName={name} />
      </Suspense>
    </div>
  );
}

function FieldListWrapper() {
  // Render the picker shell — same flow used in 3b's MetadataAdminPages.
  const client = useMetadataClient();
  return <FieldPickerShell client={client} />;
}

registerMetadataResource({
  type: 'object',
  label: 'Objects',
  description: 'Domain entities — tables in the data model. Each object owns its fields, relationships, validations, and lifecycle hooks.',
  domain: 'data',
  ListPage: ObjectListWrapper,
  EditPage: ObjectEditWrapper,
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
  description: 'Columns attached to objects. Pick an object to manage its fields.',
  domain: 'data',
  ListPage: FieldListWrapper,
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

import * as React from 'react';
import { Suspense } from 'react';
import type { MetadataClient } from '@object-ui/data-objectstack';

function FieldPickerShell({ client }: { client: MetadataClient }) {
  const [objects, setObjects] = React.useState<Array<{ name: string; label?: string }>>([]);
  const [selected, setSelected] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await client.list<any>('object');
        if (cancelled) return;
        const list = (items as any[])
          .map((o) => ({
            name: o?.item?.name ?? o?.name,
            label: o?.item?.label ?? o?.label,
          }))
          .filter((o) => !!o.name);
        setObjects(list);
        if (list[0]) setSelected(list[0].name);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading objects…</div>;

  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <label className="font-medium">Object:</label>
        <select
          className="rounded border px-2 py-1 bg-background"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {objects.map((o) => (
            <option key={o.name} value={o.name}>
              {o.label ?? o.name} ({o.name})
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading fields…</div>}>
          <MetadataFieldsPage key={selected} client={client} objectName={selected} />
        </Suspense>
      )}
    </div>
  );
}

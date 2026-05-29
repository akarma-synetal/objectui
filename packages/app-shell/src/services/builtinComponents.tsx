// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in component registrations — Phase 3b + 3c.
 *
 * Side-effect module imported by `index.ts` to ensure the platform's
 * own admin UI is registered with the ComponentRegistry before
 * AppContent mounts the first `<Route path="component/...">`.
 *
 * Registers the generic metadata admin engine and a specialised
 * permission-matrix editor for `permission`. The previous View /
 * Dashboard / Page bespoke "designer" tabs were removed: they never
 * produced usable output and confused authors. Those types now use the
 * same JSONSchema-driven Form + Preview experience as every other
 * metadata type.
 */

import { registerAppComponent } from './componentRegistry';
import {
  MetadataDirectoryPage,
  MetadataResourceRouter,
  registerMetadataResource,
} from '../views/metadata-admin';
import { PermissionMatrixEditPage } from '../views/metadata-admin/PermissionMatrixEditor';
import { PackagesPage } from '../views/metadata-admin/PackagesPage';

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
  component: MetadataResourceRouter,
});

registerAppComponent({
  ref: 'developer:packages',
  label: 'Packages',
  source: '@object-ui/app-shell',
  component: PackagesPage,
});

/* -------------------------------------------------------------------------- */
/* 2) Generic resources — list + JSONSchema-driven form for every type.       */
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
/* 4) UI metadata types — list + form. No bespoke visual designers: views,   */
/*    dashboards and pages are authored as JSON metadata; the Preview tab    */
/*    renders them live for verification.                                    */
/* -------------------------------------------------------------------------- */

registerMetadataResource({
  type: 'view',
  label: 'Views',
  description: 'Saved list / kanban / calendar / gantt configurations on top of an object.',
  domain: 'ui',
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
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'description', label: 'Description' },
  ],
});

registerMetadataResource({
  type: 'page',
  label: 'Pages',
  description: 'Visual page layouts authored as JSON metadata.',
  domain: 'ui',
  listColumns: [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'route', label: 'Route' },
  ],
});

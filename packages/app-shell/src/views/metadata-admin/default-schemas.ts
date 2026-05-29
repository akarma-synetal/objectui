// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * default-schemas — minimal JSONSchemas used by SchemaForm when the
 * framework's `/meta/types` registry row doesn't carry a `schema` field
 * (i.e. for every type today — full Zod→JSONSchema generation in the
 * framework is a deferred milestone).
 *
 * These schemas cover the universal metadata header (name/label/
 * description/scope) plus the small set of per-type "obvious" fields
 * users expect on day one. Anything that doesn't fit here can still be
 * edited via the raw JSON escape hatch — the schema is intentionally
 * lax (no `additionalProperties: false`) so unknown payload keys round-
 * trip untouched.
 *
 * When the framework starts emitting JSONSchemas in the registry, this
 * file becomes a no-op (SchemaForm receives the real schema and ignores
 * `defaultSchema`).
 */

import { registerMetadataResource } from './registry';

/** Shared header fields every metadata item has. */
const headerProps = {
  name: {
    type: 'string',
    title: 'Name',
    description: 'Machine name. snake_case, used as the URL path and DB key.',
    pattern: '^[a-z_][a-z0-9_]*$',
  },
  label: {
    type: 'string',
    title: 'Label',
    description: 'Human-readable display name.',
  },
  description: {
    type: 'string',
    title: 'Description',
    format: 'multiline',
  },
} as const;

/** Per-type fallback schemas. */
const SCHEMAS: Record<string, Record<string, unknown>> = {
  role: {
    type: 'object',
    title: 'Role',
    required: ['name'],
    properties: {
      ...headerProps,
      level: {
        type: 'string',
        title: 'Level',
        description: 'Coarse seniority tier (used by UI / sort order).',
        enum: ['member', 'lead', 'manager', 'director', 'executive', 'admin'],
      },
      parentRole: {
        type: 'string',
        title: 'Parent Role',
        description: 'Optional parent role name for hierarchy.',
      },
    },
  },

  profile: {
    type: 'object',
    title: 'Profile',
    required: ['name'],
    properties: {
      ...headerProps,
      isProfile: { type: 'boolean', title: 'Is profile', description: 'Profiles are mutually exclusive (one per user).' },
      objects: {
        type: 'object',
        title: 'Object Permissions',
        description: 'Edit this via the Permission Matrix tab for a row-by-row UI.',
      },
    },
  },

  permission: {
    type: 'object',
    title: 'Permission Set',
    required: ['name'],
    properties: {
      ...headerProps,
      isProfile: { type: 'boolean', title: 'Is profile' },
      objects: { type: 'object', title: 'Object Permissions' },
      fields: { type: 'object', title: 'Field Permissions' },
    },
  },

  translation: {
    type: 'object',
    title: 'Translation Bundle',
    required: ['name'],
    properties: {
      name: { ...headerProps.name, description: 'Bundle id (e.g. zh_CN, en_US, package-locale).' },
      label: headerProps.label,
      description: headerProps.description,
      locale: {
        type: 'string',
        title: 'Locale',
        description: 'BCP-47 tag, e.g. en, zh-Hans, ja-JP.',
      },
      strings: {
        type: 'object',
        title: 'Strings',
        description: 'Key → translated string map.',
      },
    },
  },

  tool: {
    type: 'object',
    title: 'AI Tool',
    required: ['name'],
    properties: {
      ...headerProps,
      kind: {
        type: 'string',
        title: 'Kind',
        enum: ['function', 'http', 'mcp'],
      },
      inputSchema: { type: 'object', title: 'Input Schema (JSON Schema)' },
      outputSchema: { type: 'object', title: 'Output Schema (JSON Schema)' },
    },
  },

  skill: {
    type: 'object',
    title: 'AI Skill',
    required: ['name'],
    properties: {
      ...headerProps,
      instructions: { type: 'string', title: 'Instructions', format: 'multiline' },
      tools: { type: 'array', title: 'Tools', items: { type: 'string' } },
    },
  },

  app: {
    type: 'object',
    title: 'Application',
    required: ['name'],
    properties: {
      ...headerProps,
      icon: { type: 'string', title: 'Icon' },
      navigation: { type: 'array', title: 'Navigation', items: { type: 'object' } },
    },
  },

  page: {
    type: 'object',
    title: 'Page',
    required: ['name'],
    properties: {
      ...headerProps,
      route: { type: 'string', title: 'Route', description: 'URL path under the app.' },
      layout: { type: 'string', title: 'Layout' },
    },
  },

  view: {
    type: 'object',
    title: 'View',
    required: ['name'],
    properties: {
      ...headerProps,
      type: {
        type: 'string',
        title: 'View Type',
        enum: ['grid', 'kanban', 'calendar', 'gantt', 'simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal'],
      },
    },
  },

  dashboard: {
    type: 'object',
    title: 'Dashboard',
    required: ['name'],
    properties: {
      ...headerProps,
      widgets: { type: 'array', title: 'Widgets', items: { type: 'object' } },
    },
  },

  report: {
    type: 'object',
    title: 'Report',
    required: ['name'],
    properties: {
      ...headerProps,
      object: { type: 'string', title: 'Object' },
      filters: { type: 'array', title: 'Filters', items: { type: 'object' } },
    },
  },

  email_template: {
    type: 'object',
    title: 'Email Template',
    required: ['name', 'label', 'subject', 'bodyHtml'],
    properties: {
      ...headerProps,
      category: {
        type: 'string',
        title: 'Category',
        enum: ['auth', 'notification', 'workflow', 'marketing', 'custom'],
        default: 'custom',
      },
      locale: { type: 'string', title: 'Locale', default: 'en-US', description: 'BCP-47 tag (en-US, zh-CN, …)' },
      subject: { type: 'string', title: 'Subject', description: 'Supports {{var.path}} interpolation' },
      bodyHtml: { type: 'string', title: 'HTML Body', format: 'multiline' },
      bodyText: { type: 'string', title: 'Plain-Text Body', format: 'multiline' },
      variables: { type: 'array', title: 'Variables', items: { type: 'object' } },
      fromOverride: { type: 'object', title: 'From Override' },
      replyTo: { type: 'string', title: 'Reply-To' },
      active: { type: 'boolean', title: 'Active', default: true },
      isSystem: { type: 'boolean', title: 'System Template', default: false },
    },
  },
};

/**
 * Register fallback schemas for every writable type. Idempotent — uses
 * `registerMetadataResource` so any prior registration (e.g. a bespoke
 * EditPage from PermissionMatrixEditor) is merged via the engine.
 */
export function registerDefaultMetadataSchemas(): void {
  for (const [type, schema] of Object.entries(SCHEMAS)) {
    registerMetadataResource({
      type,
      defaultSchema: schema,
      fieldOrder: ['name', 'label', 'description'],
    });
  }
}

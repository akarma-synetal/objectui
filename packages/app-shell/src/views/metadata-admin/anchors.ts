// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in anchor relationships for the Related tab.
 *
 * Each entry tells the metadata-admin engine "items of type X belong to
 * (are anchored at) items of type Y when this predicate matches". The
 * Related panel on the parent's edit page uses this registry to decide
 * which `client.list(type)` calls to make and how to group the results.
 *
 * Adding a new relationship is intentionally a one-liner — declare it
 * here (or in your own plugin's bootstrap) and the UI picks it up with
 * no further wiring. Predicates are kept tiny because they run client-
 * side over every item returned from `list()`.
 *
 * Why not parse the schema and infer this? Some types nest the anchor
 * deep in `data.object` or `list.data.object`; some types live on the
 * parent (e.g. `fields` is embedded inside the object item itself).
 * Hand-rolled declarations are clearer than schema-walking heuristics.
 */

import { registerMetadataResource, anchorByField } from './registry';

export function registerBuiltinAnchors(): void {
  // ── EMBEDDED: items stored inside the object body itself ──────────
  //
  // Fields, indexes, and embedded validations don't have a top-level
  // metadata type; they live under `object.fields`, `object.indexes[]`,
  // `object.validations[]`. We surface them with `source: 'embedded'`
  // so the Related panel can list them without a separate API call.
  //
  // `fields` is stored as a NAME-KEYED MAP (`{ email: {...}, name: {...} }`)
  // — not an array — so we adapt it into an array carrying the key as
  // `name` for the panel to render.
  registerMetadataResource({
    type: '__object_field' as any,
    label: 'Field',
    anchors: [{
      anchorType: 'object',
      source: 'embedded',
      editAs: 'field',
      embeddedPath: 'fields',
      extract: (parent) => mapOrArrayToList((parent as { fields?: unknown }).fields),
      groupLabel: 'Fields',
      order: 5,
    }],
  });

  registerMetadataResource({
    type: '__object_index' as any,
    label: 'Index',
    anchors: [{
      anchorType: 'object',
      source: 'embedded',
      embeddedPath: 'indexes',
      extract: (parent) => {
        const raw = (parent as { indexes?: unknown }).indexes;
        if (!Array.isArray(raw)) return [];
        // Indexes have no `name`; synthesise one from their column list.
        return (raw as Array<Record<string, unknown>>).map((idx, i) => {
          const fields = Array.isArray(idx.fields) ? idx.fields.join(',') : '';
          const synthesised = fields ? `idx_${fields}` : `index_${i}`;
          return { name: synthesised, ...idx };
        });
      },
      groupLabel: 'Indexes',
      order: 10,
    }],
  });

  registerMetadataResource({
    type: '__object_validation' as any,
    label: 'Embedded validation',
    anchors: [{
      anchorType: 'object',
      source: 'embedded',
      editAs: 'validation',
      embeddedPath: 'validations',
      extract: (parent) => mapOrArrayToList((parent as { validations?: unknown }).validations),
      groupLabel: 'Embedded Validations',
      order: 15,
    }],
  });

  // ── LIST: standalone child metadata types ─────────────────────────

  // hook.object → object (beforeInsert / afterUpdate / …)
  registerMetadataResource({
    type: 'hook',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Hooks',
      order: 20,
    }],
  });

  // approval.object → object (approval processes targeting this object)
  registerMetadataResource({
    type: 'approval',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Approval Processes',
      order: 70,
    }],
  });

  // page.object → object (auto-generated record pages, etc.)
  registerMetadataResource({
    type: 'page',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Pages',
      order: 40,
    }],
  });

  // view binds to an object via data.object (list view / form view variants)
  registerMetadataResource({
    type: 'view',
    anchors: [{
      anchorType: 'object',
      match: anchorByField([
        'data.object',
        'list.data.object',
        'form.data.object',
        'object',
      ]),
      groupLabel: 'Views',
      order: 30,
    }],
  });

  // flow / workflow may reference an object at the root or under `on`
  registerMetadataResource({
    type: 'flow',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'on.object', 'trigger.object']),
      groupLabel: 'Flows',
      order: 50,
    }],
  });
  registerMetadataResource({
    type: 'workflow',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'on.object']),
      groupLabel: 'Workflow Rules',
      order: 51,
    }],
  });

  // trigger.object → object (low-level DB-style triggers)
  registerMetadataResource({
    type: 'trigger',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'on.object']),
      groupLabel: 'Triggers',
      order: 52,
    }],
  });

  // validation: usually embedded in the object, but standalone variants
  // do exist. Match anything whose `object` points back at us.
  registerMetadataResource({
    type: 'validation',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Validations',
      order: 25,
    }],
  });

  // permission has a sparse object-keyed map under `objects`. Match by
  // membership of the parent name in that map.
  registerMetadataResource({
    type: 'permission',
    anchors: [{
      anchorType: 'object',
      match: (item, name) => {
        const objs = (item as { objects?: Record<string, unknown> })?.objects;
        return !!objs && typeof objs === 'object' && name in objs;
      },
      groupLabel: 'Permissions',
      order: 60,
    }],
  });

  // action — both record-scoped and object-scoped actions live here.
  // Schemas vary, so accept any of the three common shapes.
  registerMetadataResource({
    type: 'action',
    anchors: [{
      anchorType: 'object',
      match: anchorByField([
        'object',
        'target.object',
        'on.object',
      ]),
      groupLabel: 'Actions',
      order: 55,
    }],
  });

  // dashboard / report — surface ones bound to a specific object.
  // Many will not have an explicit anchor; those simply don't appear.
  registerMetadataResource({
    type: 'dashboard',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'data.object']),
      groupLabel: 'Dashboards',
      order: 80,
    }],
  });
  registerMetadataResource({
    type: 'report',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'data.object']),
      groupLabel: 'Reports',
      order: 81,
    }],
  });
}

/**
 * Coerce an embedded "collection" into a list of `{ name, …rest }`.
 *
 * ObjectStack stores some embedded collections as name-keyed maps
 * (`object.fields`) and others as arrays (`object.indexes`). Both want
 * to render the same way in Related; this helper papers over the gap
 * by injecting the map key as `name` when needed.
 */
function mapOrArrayToList(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([k, v]) => {
      const body = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
      return { name: k, ...body };
    });
  }
  return [];
}

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

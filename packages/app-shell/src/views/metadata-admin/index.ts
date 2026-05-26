// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public surface for the metadata-admin engine (Phase 3c).
 *
 * Pages are registered with the ComponentRegistry in
 * `../../services/builtinComponents.ts`; consumers (and plugins) can
 * still import directly to compose custom shells.
 *
 * The Registry export lets plugin authors opt their bespoke editors
 * into the generic shell:
 *
 *   import { registerMetadataResource } from '@object-ui/app-shell';
 *   registerMetadataResource({ type: 'view', EditPage: MyViewEditor });
 */

export { MetadataDirectoryPage } from './DirectoryPage';
export { MetadataResourceRouter } from './ResourceRouter';
export { MetadataResourceListPage } from './ResourceListPage';
export { MetadataResourceEditPage } from './ResourceEditPage';
export { MetadataResourceHistoryPage } from './ResourceHistoryPage';
export { MetadataQuickFind } from './QuickFind';
export { PageShell as MetadataPageShell } from './PageShell';
export { SchemaForm } from './SchemaForm';
export { LayeredDiff } from './LayeredDiff';
export { PermissionMatrixEditPage } from './PermissionMatrixEditor';
export { DesignerEditorWrapper } from './DesignerEditorWrapper';
export type { DesignerEditorWrapperProps } from './DesignerEditorWrapper';
export {
  translateMetadataType,
  translateMetadataDomain,
  t as translateMetadataAdmin,
  detectLocale,
} from './i18n';
export type { SupportedLocale } from './i18n';

export {
  registerMetadataResource,
  getMetadataResource,
  listMetadataResources,
  resolveResourceConfig,
} from './registry';
export type {
  MetadataResourceConfig,
  MetadataDomain,
} from './registry';

// Side-effect: register fallback JSONSchemas for the 12 writable types
// so the generic SchemaForm renders a real form (vs raw-JSON fallback)
// until the framework wires Zod→JSONSchema generation into /meta/types.
import { registerDefaultMetadataSchemas } from './default-schemas';
registerDefaultMetadataSchemas();

export {
  useMetadataClient,
  useMetadataTypes,
  useTypesIndex,
  matchesQuery,
} from './useMetadata';
export type { RichMetadataTypeEntry } from './useMetadata';

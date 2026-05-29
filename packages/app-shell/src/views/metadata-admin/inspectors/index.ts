// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Registers built-in metadata inspectors. Mirrors `previews/index.ts`.
 * Imported as a side effect from `metadata-admin/index.ts`.
 */

import { registerMetadataInspector } from '../inspector-registry';
import { DashboardWidgetInspector } from './DashboardWidgetInspector';

export function registerBuiltinInspectors(): void {
  registerMetadataInspector('dashboard', DashboardWidgetInspector);
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Registers built-in metadata inspectors. Mirrors `previews/index.ts`.
 * Imported as a side effect from `metadata-admin/index.ts`.
 */

import { registerMetadataInspector } from '../inspector-registry';
import { registerMetadataDefaultInspector } from '../default-inspector-registry';
import { DashboardWidgetInspector } from './DashboardWidgetInspector';
import { FlowNodeInspector } from './FlowNodeInspector';
import { ApprovalStepInspector } from './ApprovalStepInspector';
import { WorkflowActionInspector } from './WorkflowActionInspector';
import { AppNavInspector } from './AppNavInspector';
import { ViewInspector, ViewDefaultInspector } from './ViewInspector';
import { PageBlockInspector } from './PageBlockInspector';
import { ReportColumnInspector } from './ReportColumnInspector';
import { ObjectFieldInspector } from './ObjectFieldInspector';

export function registerBuiltinInspectors(): void {
  registerMetadataInspector('dashboard', DashboardWidgetInspector);
  registerMetadataInspector('flow', FlowNodeInspector);
  registerMetadataInspector('approval', ApprovalStepInspector);
  registerMetadataInspector('workflow', WorkflowActionInspector);
  registerMetadataInspector('app', AppNavInspector);
  registerMetadataInspector('view', ViewInspector);
  registerMetadataDefaultInspector('view', ViewDefaultInspector);
  registerMetadataInspector('page', PageBlockInspector);
  registerMetadataInspector('report', ReportColumnInspector);
  registerMetadataInspector('object', ObjectFieldInspector);
}

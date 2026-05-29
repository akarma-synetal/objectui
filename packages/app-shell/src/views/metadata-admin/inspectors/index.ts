// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Registers built-in metadata inspectors. Mirrors `previews/index.ts`.
 * Imported as a side effect from `metadata-admin/index.ts`.
 */

import { registerMetadataInspector } from '../inspector-registry';
import { DashboardWidgetInspector } from './DashboardWidgetInspector';
import { FlowNodeInspector } from './FlowNodeInspector';
import { ApprovalStepInspector } from './ApprovalStepInspector';
import { WorkflowActionInspector } from './WorkflowActionInspector';
import { AppNavInspector } from './AppNavInspector';
import { ViewColumnInspector } from './ViewColumnInspector';
import { PageBlockInspector } from './PageBlockInspector';
import { ReportColumnInspector } from './ReportColumnInspector';

export function registerBuiltinInspectors(): void {
  registerMetadataInspector('dashboard', DashboardWidgetInspector);
  registerMetadataInspector('flow', FlowNodeInspector);
  registerMetadataInspector('approval', ApprovalStepInspector);
  registerMetadataInspector('workflow', WorkflowActionInspector);
  registerMetadataInspector('app', AppNavInspector);
  registerMetadataInspector('view', ViewColumnInspector);
  registerMetadataInspector('page', PageBlockInspector);
  registerMetadataInspector('report', ReportColumnInspector);
}

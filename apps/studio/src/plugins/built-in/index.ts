// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugins Barrel Export
 * 
 * All built-in plugins are registered by default when Studio starts.
 * External plugins can be added at runtime via the PluginRegistry.
 */

import type { StudioPlugin } from '../types';

// Core plugins
import { objectDesignerPlugin } from './object-plugin';
import { defaultInspectorPlugin } from './default-plugin';

// Playground plugins
import { agentPlaygroundPlugin } from './agent-playground-plugin';
import { toolPlaygroundPlugin } from './tool-playground-plugin';
import { flowViewerPlugin } from './flow-viewer-plugin';
import { viewPreviewPlugin } from './view-preview-plugin';
import { historyViewerPlugin } from './history-plugin';

// Protocol plugins (sidebar groups + icons)
import { uiProtocolPlugin } from './ui-plugin';
import { automationProtocolPlugin } from './automation-plugin';
import { securityProtocolPlugin } from './security-plugin';
import { aiProtocolPlugin } from './ai-plugin';
import { apiProtocolPlugin } from './api-plugin';

/** All built-in plugins, in activation order */
export const builtInPlugins: StudioPlugin[] = [
  // The default inspector MUST be first — it provides the wildcard fallback
  defaultInspectorPlugin,

  // Object designer (highest priority for object/objects types)
  objectDesignerPlugin,

  // Playground plugins (priority 10, higher than default inspector)
  agentPlaygroundPlugin,
  toolPlaygroundPlugin,
  flowViewerPlugin,
  viewPreviewPlugin,

  // Wildcard history timeline — available for every metadata type in `history` mode (ADR-0008 §5)
  historyViewerPlugin,

  // Protocol group plugins (provide sidebar groups + icons)
  uiProtocolPlugin,
  automationProtocolPlugin,
  securityProtocolPlugin,
  aiProtocolPlugin,
  apiProtocolPlugin,
];

// Re-export individual plugins for selective use / testing
export {
  objectDesignerPlugin,
  defaultInspectorPlugin,
  agentPlaygroundPlugin,
  toolPlaygroundPlugin,
  flowViewerPlugin,
  viewPreviewPlugin,
  historyViewerPlugin,
  uiProtocolPlugin,
  automationProtocolPlugin,
  securityProtocolPlugin,
  aiProtocolPlugin,
  apiProtocolPlugin,
};

/**
 * Main Entry Point
 *
 * Renders the React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { I18nProvider } from '@object-ui/i18n';
import { MobileProvider } from '@object-ui/mobile';
import { ComponentRegistry } from '@object-ui/core';
import { loadLanguage } from './loadLanguage';

// ────────────────────────────────────────────────────────────────────────────
// Plugin registration
// ────────────────────────────────────────────────────────────────────────────
//
// Eager imports — core views needed on most pages.  These are cheap (no heavy
// 3rd-party deps) so paying their cost upfront is the right tradeoff.
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-view';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-dashboard';

// Lazy plugins — registered as deferred loaders.  The first time the
// SchemaRenderer encounters one of these `type` values, the plugin module is
// imported on-demand (and its top-level `ComponentRegistry.register()` calls
// run as a side-effect).  This keeps maplibre-gl, recharts, frappe-gantt,
// markdown renderers, etc. out of the initial bundle.
ComponentRegistry.registerLazy('object-map', () => import('@object-ui/plugin-map'), {
  namespace: 'plugin-map',
  category: 'view',
});
ComponentRegistry.registerLazy('map', () => import('@object-ui/plugin-map'), {
  namespace: 'view',
  category: 'view',
});

ComponentRegistry.registerLazy('chart', () => import('@object-ui/plugin-charts'), {
  namespace: 'plugin-charts',
  category: 'chart',
});
// Additional chart variants registered by @object-ui/plugin-charts so the
// renderer can lazy-load when any chart type appears in a schema.
for (const variant of ['bar-chart', 'pie-chart', 'donut-chart', 'radar-chart', 'scatter-chart', 'line-chart', 'area-chart', 'advanced-chart', 'chart:bar']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-charts'), {
    namespace: 'plugin-charts',
    category: 'chart',
  });
}

ComponentRegistry.registerLazy('object-gantt', () => import('@object-ui/plugin-gantt'), {
  namespace: 'plugin-gantt',
  category: 'view',
});
ComponentRegistry.registerLazy('gantt', () => import('@object-ui/plugin-gantt'), {
  namespace: 'view',
  category: 'view',
});

ComponentRegistry.registerLazy('markdown', () => import('@object-ui/plugin-markdown'), {
  namespace: 'plugin-markdown',
  category: 'display',
});

ComponentRegistry.registerLazy('object-timeline', () => import('@object-ui/plugin-timeline'), {
  namespace: 'plugin-timeline',
  category: 'view',
});
ComponentRegistry.registerLazy('timeline', () => import('@object-ui/plugin-timeline'), {
  namespace: 'view',
  category: 'view',
});

ComponentRegistry.registerLazy('object-calendar', () => import('@object-ui/plugin-calendar'), {
  namespace: 'plugin-calendar',
  category: 'view',
});
ComponentRegistry.registerLazy('calendar', () => import('@object-ui/plugin-calendar'), {
  namespace: 'view',
  category: 'view',
});
ComponentRegistry.registerLazy('calendar-view', () => import('@object-ui/plugin-calendar'), {
  namespace: 'plugin-calendar',
  category: 'view',
});

ComponentRegistry.registerLazy('object-kanban', () => import('@object-ui/plugin-kanban'), {
  namespace: 'plugin-kanban',
  category: 'view',
});
ComponentRegistry.registerLazy('kanban', () => import('@object-ui/plugin-kanban'), {
  namespace: 'view',
  category: 'view',
});
for (const variant of ['kanban-ui', 'kanban-enhanced']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-kanban'), {
    namespace: 'plugin-kanban',
    category: 'view',
  });
}

ComponentRegistry.registerLazy('report', () => import('@object-ui/plugin-report'), {
  namespace: 'plugin-report',
  category: 'view',
});
for (const variant of ['report-viewer', 'report-builder']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-report'), {
    namespace: 'plugin-report',
    category: 'view',
  });
}

// Register console-specific schema widgets (object detail page sections)
import './components/schema/registerObjectDetailWidgets';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileProvider pwa={{ enabled: true, name: 'ObjectUI Console', shortName: 'Console' }}>
      <I18nProvider loadLanguage={loadLanguage}>
        <App />
      </I18nProvider>
    </MobileProvider>
  </React.StrictMode>
);

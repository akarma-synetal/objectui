import React from 'react';
import type { Preview, Decorator } from '@storybook/react-vite'
import '../packages/components/src/index.css';

import * as components from '../packages/components/src/index';
import { SchemaRendererProvider } from '@object-ui/react';

// Register all base components for Storybook
Object.values(components);


// Import and register all plugin components for Storybook
// This ensures plugin components are available for the plugin stories
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-chatbot';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-editor';
import '@object-ui/plugin-form';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-list';
import '@object-ui/plugin-map';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-report';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-view';
import '@object-ui/layout';
import '@object-ui/fields';

// Global decorator: wrap every story in SchemaRendererProvider so that
// plugin components calling useSchemaContext() never throw.
// Stories that need a specific dataSource can still wrap with their own provider
// (the innermost provider wins via React context).
const withSchemaProvider: Decorator = (Story) =>
  React.createElement(
    SchemaRendererProvider,
    { dataSource: {} },
    React.createElement(Story)
  );

const preview: Preview = {
  decorators: [withSchemaProvider],
  parameters: {
    options: {
      storySort: {
        method: 'alphabetical',
        order: [
          'Getting Started',
            ['Introduction', 'Data Binding'],
          'Primitives',
            ['General', 'Data Display', 'Data Entry', 'Navigation', 'Feedback', 'Overlay', 'Layout'],
          'Fields',
            ['Gallery'],
          'Plugins',
            ['Data Views', 'Forms', 'Scheduling', 'Rich Content'],
          'Templates',
            ['Dashboard', 'Page', 'Reports', 'Sidebar'],
        ],
      },
    },
    viewport: {
      viewports: {
        iphoneSE: { name: 'iPhone SE', styles: { width: '375px', height: '667px' } },
        iphone14: { name: 'iPhone 14', styles: { width: '390px', height: '844px' } },
        ipadMini: { name: 'iPad Mini', styles: { width: '768px', height: '1024px' } },
        pixel5: { name: 'Pixel 5', styles: { width: '393px', height: '851px' } },
      },
    },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;

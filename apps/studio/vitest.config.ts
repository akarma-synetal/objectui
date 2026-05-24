// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/// <reference types="vitest" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

const polyfillPath = path.resolve(__dirname, './mocks/node-polyfills.ts');

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  test: {
    name: 'studio',
    globals: true,
    environment: 'happy-dom',
    setupFiles: [path.resolve(__dirname, './test/setup.ts')],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockServiceWorker.js',
        'dist/',
        'src/routeTree.gen.ts',
        'src/mocks/',
      ],
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@': path.resolve(__dirname, './src'),
      // Workspace packages: resolve to src/ so tests don't need a prior
      // build step in CI (packages would otherwise be unresolvable until
      // turbo build emits dist/).
      '@object-ui/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
      '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
      '@object-ui/types/zod': path.resolve(__dirname, '../../packages/types/src/zod/index.zod.ts'),
      '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
      '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
      '@object-ui/protocol': path.resolve(__dirname, '../../packages/core/src'),
      '@object-ui/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@object-ui/renderer': path.resolve(__dirname, '../../packages/renderer/src'),
      '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
      '@object-ui/providers': path.resolve(__dirname, '../../packages/providers/src'),
      '@object-ui/fields': path.resolve(__dirname, '../../packages/fields/src'),
      '@object-ui/plugin-dashboard': path.resolve(__dirname, '../../packages/plugin-dashboard/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, '../../packages/plugin-grid/src'),
      '@object-ui/plugin-kanban': path.resolve(__dirname, '../../packages/plugin-kanban/src'),
      '@object-ui/plugin-charts': path.resolve(__dirname, '../../packages/plugin-charts/src'),
      '@object-ui/plugin-list': path.resolve(__dirname, '../../packages/plugin-list/src'),
      '@object-ui/data-objectstack': path.resolve(__dirname, '../../packages/data-objectstack/src'),
      '@object-ui/layout': path.resolve(__dirname, '../../packages/layout/src'),
      '@object-ui/plugin-calendar': path.resolve(__dirname, '../../packages/plugin-calendar/src'),
      '@object-ui/plugin-chatbot': path.resolve(__dirname, '../../packages/plugin-chatbot/src'),
      '@object-ui/plugin-detail': path.resolve(__dirname, '../../packages/plugin-detail/src'),
      '@object-ui/plugin-editor': path.resolve(__dirname, '../../packages/plugin-editor/src'),
      '@object-ui/plugin-form': path.resolve(__dirname, '../../packages/plugin-form/src'),
      '@object-ui/plugin-gantt': path.resolve(__dirname, '../../packages/plugin-gantt/src'),
      '@object-ui/plugin-map': path.resolve(__dirname, '../../packages/plugin-map/src'),
      '@object-ui/plugin-markdown': path.resolve(__dirname, '../../packages/plugin-markdown/src'),
      '@object-ui/plugin-timeline': path.resolve(__dirname, '../../packages/plugin-timeline/src'),
      '@object-ui/plugin-view': path.resolve(__dirname, '../../packages/plugin-view/src'),
      '@object-ui/plugin-report': path.resolve(__dirname, '../../packages/plugin-report/src'),
      '@object-ui/plugin-ai': path.resolve(__dirname, '../../packages/plugin-ai/src'),
      '@object-ui/plugin-designer': path.resolve(__dirname, '../../packages/plugin-designer/src'),
      '@object-ui/plugin-workflow': path.resolve(__dirname, '../../packages/plugin-workflow/src'),
      '@object-ui/runner': path.resolve(__dirname, '../../packages/runner/src'),
      '@object-ui/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@object-ui/mobile': path.resolve(__dirname, '../../packages/mobile/src'),
      '@object-ui/permissions': path.resolve(__dirname, '../../packages/permissions/src'),
      '@object-ui/collaboration': path.resolve(__dirname, '../../packages/collaboration/src'),
      '@object-ui/tenant': path.resolve(__dirname, '../../packages/tenant/src'),
      '@object-ui/app-shell': path.resolve(__dirname, '../../packages/app-shell/src'),
      '@object-ui/ui': path.resolve(__dirname, '../../packages/ui/src'),
      // Node built-ins stubbed for browser-like test env
      'node:fs/promises': polyfillPath,
      'node:fs': polyfillPath,
      'node:events': polyfillPath,
      'node:stream': polyfillPath,
      'node:string_decoder': polyfillPath,
      'node:path': polyfillPath,
      'node:url': polyfillPath,
      'node:util': polyfillPath,
      'node:os': polyfillPath,
      'node:crypto': polyfillPath,
      'events': polyfillPath,
      'stream': polyfillPath,
      'string_decoder': polyfillPath,
      'path': polyfillPath,
      'fs/promises': polyfillPath,
      'fs': polyfillPath,
      'util': polyfillPath,
      'os': polyfillPath,
      'crypto': polyfillPath,
      'url': polyfillPath,
      // Chokidar stub (not needed in the browser/test environment)
      'chokidar': path.resolve(__dirname, './src/mocks/noop.ts'),
    },
  },
});

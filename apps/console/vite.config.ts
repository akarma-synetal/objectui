import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteCryptoStub } from '../../scripts/vite-crypto-stub';
import { compression } from 'vite-plugin-compression2';
import { visualizer } from 'rollup-plugin-visualizer';

// Critical chunks that should be preloaded for faster initial page render.
// These are the chunks needed on every page load (framework + vendor-react).
const CRITICAL_CHUNK_PREFIXES = ['vendor-react', 'framework', 'ui-components', 'vendor-radix'];

/**
 * Vite plugin that injects <link rel="modulepreload"> hints for critical chunks
 * into the built HTML, enabling the browser to fetch them in parallel with the
 * main entry script.
 */
function preloadCriticalChunks(): Plugin {
  return {
    name: 'preload-critical-chunks',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const preloadTags: string[] = [];
      for (const [fileName] of Object.entries(ctx.bundle)) {
        if (
          fileName.endsWith('.js') &&
          CRITICAL_CHUNK_PREFIXES.some((prefix) => fileName.includes(prefix))
        ) {
          preloadTags.push(`<link rel="modulepreload" href="${basePath}${fileName}" />`);
        }
      }
      if (preloadTags.length === 0) return html;
      return html.replace('</head>', `    ${preloadTags.join('\n    ')}\n  </head>`);
    },
  };
}

// Base path for SPA deployment. Always '/console/' to match the HonoServerPlugin
// auto-mount slug. Override with VITE_BASE_PATH only if deploying standalone.
const basePath = process.env.VITE_BASE_PATH || '/console/';

// On Vercel/CI we skip the compression and visualizer plugins because the
// Vercel CDN handles gzip/brotli automatically and bundle analysis is not
// needed during CI builds.  This reduces peak memory by ~1.5 GB.
//
// Workspace src/ aliases are kept in ALL environments (dev + CI) so that
// plugin side-effect imports (ComponentRegistry.register) resolve correctly.
// Without them, Vite would import pre-built dist/ bundles where the
// singleton ComponentRegistry can get duplicated across chunks, causing
// "Unknown component type" errors at runtime.
const isCI = !!(process.env.VERCEL || process.env.CI);

// Workspace src/ aliases — gives instant HMR in dev and ensures correct
// side-effect resolution (plugin registrations) in production builds.
const workspaceAliases: Record<string, string> = {
  '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
  '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
  '@object-ui/fields': path.resolve(__dirname, '../../packages/fields/src'),
  '@object-ui/layout': path.resolve(__dirname, '../../packages/layout/src'),
  '@object-ui/plugin-dashboard': path.resolve(__dirname, '../../packages/plugin-dashboard/src'),
  '@object-ui/plugin-report': path.resolve(__dirname, '../../packages/plugin-report/src'),
  '@object-ui/plugin-form': path.resolve(__dirname, '../../packages/plugin-form/src'),
  '@object-ui/plugin-grid': path.resolve(__dirname, '../../packages/plugin-grid/src'),
  '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
  '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
  '@object-ui/data-objectstack': path.resolve(__dirname, '../../packages/data-objectstack/src'),
  '@object-ui/auth': path.resolve(__dirname, '../../packages/auth/src'),
  '@object-ui/permissions': path.resolve(__dirname, '../../packages/permissions/src'),
  '@object-ui/collaboration': path.resolve(__dirname, '../../packages/collaboration/src'),
  '@object-ui/tenant': path.resolve(__dirname, '../../packages/tenant/src'),
  '@object-ui/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
  '@object-ui/mobile': path.resolve(__dirname, '../../packages/mobile/src'),
  '@object-ui/app-shell': path.resolve(__dirname, '../../packages/app-shell/src'),

  // Plugin Aliases
  '@object-ui/plugin-aggrid': path.resolve(__dirname, '../../packages/plugin-aggrid/src'),
  '@object-ui/plugin-calendar': path.resolve(__dirname, '../../packages/plugin-calendar/src'),
  '@object-ui/plugin-charts': path.resolve(__dirname, '../../packages/plugin-charts/src'),
  '@object-ui/plugin-chatbot': path.resolve(__dirname, '../../packages/plugin-chatbot/src'),
  '@object-ui/plugin-detail': path.resolve(__dirname, '../../packages/plugin-detail/src'),
  '@object-ui/plugin-editor': path.resolve(__dirname, '../../packages/plugin-editor/src'),
  '@object-ui/plugin-gantt': path.resolve(__dirname, '../../packages/plugin-gantt/src'),
  '@object-ui/plugin-kanban': path.resolve(__dirname, '../../packages/plugin-kanban/src'),
  '@object-ui/plugin-list': path.resolve(__dirname, '../../packages/plugin-list/src'),
  '@object-ui/plugin-map': path.resolve(__dirname, '../../packages/plugin-map/src'),
  '@object-ui/plugin-markdown': path.resolve(__dirname, '../../packages/plugin-markdown/src'),
  '@object-ui/plugin-timeline': path.resolve(__dirname, '../../packages/plugin-timeline/src'),
  '@object-ui/plugin-view': path.resolve(__dirname, '../../packages/plugin-view/src'),
  '@object-ui/plugin-designer': path.resolve(__dirname, '../../packages/plugin-designer/src'),
};

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
  define: {
    'process.env': {},
    'process.platform': '"browser"',
    'process.version': '"0.0.0"',
  },

  plugins: [
    viteCryptoStub(),
    react(),
    // Inject <link rel="modulepreload"> for critical chunks
    preloadCriticalChunks(),
    // Gzip/Brotli compression & bundle visualizer are skipped on Vercel/CI to
    // reduce memory usage — Vercel's CDN compresses assets automatically.
    ...(!isCI ? [
      compression({
        algorithm: 'gzip',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 1024,
      }),
      compression({
        algorithm: 'brotliCompress',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 1024,
      }),
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    ] : []),
  ],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: workspaceAliases,
  },
  optimizeDeps: {
    include: [
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui',
      'react-map-gl',
      'react-map-gl/maplibre',
      'maplibre-gl'
    ],
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      },
      resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    }
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    cssCodeSplit: true,
    // Don't pre-emit `<link rel="modulepreload">` for every chunk; it
    // negates lazy-loading by pulling all 1700+ icon chunks and heavy
    // plugin chunks during the initial HTML parse.
    modulePreload: false,
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor: React ecosystem
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Vendor: Radix UI primitives
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // Vendor: @objectstack/* SDK & spec
          // Match both regular and pnpm-virtualised paths (`.pnpm/@objectstack+client@...`).
          if (
            id.includes('node_modules/@objectstack/') ||
            id.includes('/@objectstack+') ||
            id.includes('\\@objectstack+')
          ) {
            return 'vendor-objectstack';
          }
          // Vendor: Lucide icons — only bundle the runtime helpers; let
          // `lucide-react/dynamic` split each icon into its own chunk.
          if (id.includes('node_modules/lucide-react/dist/lucide-react') ||
              id.includes('node_modules/lucide-react/dist/esm/Icon') ||
              id.includes('node_modules/lucide-react/dist/esm/createLucideIcon') ||
              id.includes('node_modules/lucide-react/dist/esm/defaultAttributes') ||
              id.includes('node_modules/lucide-react/dist/esm/shared')) {
            return 'vendor-icons-core';
          }
          // Vendor: UI utilities (cva, clsx, tailwind-merge, sonner)
          if (id.includes('node_modules/class-variance-authority/') ||
              id.includes('node_modules/clsx/') ||
              id.includes('node_modules/tailwind-merge/') ||
              id.includes('node_modules/sonner/')) {
            return 'vendor-ui-utils';
          }
          // Zod (validation)
          if (id.includes('node_modules/zod/')) {
            return 'vendor-zod';
          }
          // Recharts (charts)
          if (id.includes('node_modules/recharts/') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // DnD Kit
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'vendor-dndkit';
          }
          // i18next
          if (id.includes('node_modules/i18next') ||
              id.includes('node_modules/react-i18next/')) {
            return 'vendor-i18n';
          }
          // @object-ui/core + @object-ui/react (framework)
          if (id.includes('/packages/core/') ||
              id.includes('/packages/react/') ||
              id.includes('/packages/types/')) {
            return 'framework';
          }
          // @object-ui/components + @object-ui/fields (UI atoms)
          if (id.includes('/packages/components/') ||
              id.includes('/packages/fields/')) {
            return 'ui-components';
          }
          // @object-ui/layout
          if (id.includes('/packages/layout/')) {
            return 'ui-layout';
          }
          // @object-ui/data-objectstack adapter
          if (id.includes('/packages/data-objectstack/')) {
            return 'data-adapter';
          }
          // Infrastructure: auth, permissions, tenant, i18n
          if (id.includes('/packages/auth/') ||
              id.includes('/packages/permissions/') ||
              id.includes('/packages/tenant/') ||
              id.includes('/packages/i18n/')) {
            return 'infrastructure';
          }
          // Plugins: split each into its own chunk for fine-grained code-splitting.
          // (Was previously merged into a `plugins-core` 1.5MB monolith that
          // forced form-only or grid-only pages to download all three.)
          if (id.includes('/packages/plugin-grid/')) {
            return 'plugin-grid';
          }
          if (id.includes('/packages/plugin-form/')) {
            return 'plugin-form';
          }
          if (id.includes('/packages/plugin-view/')) {
            return 'plugin-view';
          }
          // Plugins: detail, list, dashboard, report
          if (id.includes('/packages/plugin-detail/') ||
              id.includes('/packages/plugin-list/') ||
              id.includes('/packages/plugin-dashboard/') ||
              id.includes('/packages/plugin-report/')) {
            return 'plugins-views';
          }
          // Heavy / lazy-loaded plugins — keep one chunk per plugin so the
          // dynamic `import()` boundary in main.tsx can pull only what's used.
          if (id.includes('/packages/plugin-map/')) {
            return 'plugin-map';
          }
          if (id.includes('/packages/plugin-charts/')) {
            return 'plugin-charts';
          }
          if (id.includes('/packages/plugin-gantt/')) {
            return 'plugin-gantt';
          }
          if (id.includes('/packages/plugin-markdown/')) {
            return 'plugin-markdown';
          }
          if (id.includes('/packages/plugin-timeline/')) {
            return 'plugin-timeline';
          }
          if (id.includes('/packages/plugin-calendar/')) {
            return 'plugin-calendar';
          }
          if (id.includes('/packages/plugin-kanban/')) {
            return 'plugin-kanban';
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['../../vitest.setup.tsx'],
    server: {
      deps: {
        inline: [/@objectstack/],
      },
    },
  },
  server: {},
});

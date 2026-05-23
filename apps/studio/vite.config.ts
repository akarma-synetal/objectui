import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

// HMR config for embedded mode (running inside CLI via --ui)
const hmrConfig = process.env.VITE_HMR_PORT
  ? { port: parseInt(process.env.VITE_HMR_PORT), clientPort: parseInt(process.env.VITE_HMR_PORT) }
  : undefined;

// The published build uses a relative base so the same `dist/` works under
// any mount path. Demo / standalone deployments can pin an absolute base
// via VITE_BASE (e.g. '/_studio/'). Router basename is derived from
// `document.baseURI` at runtime (see src/router.tsx).
const basePath = process.env.VITE_BASE || './';

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  server: {
    // Default to 5173 (Vite default) to avoid conflict with ObjectStack API server on 3000.
    // Use VITE_PORT env var to override (e.g. when embedded in CLI via --ui).
    port: parseInt(process.env.VITE_PORT || '5173'),
    hmr: hmrConfig,
    // Proxy API requests to the ObjectStack server when running standalone
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Auth UI lives in the Account SPA mounted on the backend at /_account/.
      // Studio hard-navigates here for sign-in (see src/lib/auth-redirect.ts);
      // without this proxy, Vite would SPA-fallback to Studio's index.html and
      // the auth guard would loop indefinitely.
      '/_account': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui',
      '@objectstack/spec/studio',
      '@objectstack/client-react',
    ],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Split heavy vendor groups into their own chunks so the main bundle
      // stays under the warning threshold and the browser can cache them
      // independently across deploys.
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]@object-ui[\\/]plugin-form[\\/]/.test(id)) return 'vendor-object-ui-form';
          if (/[\\/]@object-ui[\\/]plugin-grid[\\/]/.test(id)) return 'vendor-object-ui-grid';
          if (/[\\/]@object-ui[\\/]plugin-(dashboard|report|kanban|calendar|timeline)[\\/]/.test(id)) return 'vendor-object-ui-views';
          if (/[\\/]@object-ui[\\/]/.test(id)) return 'vendor-object-ui-core';
          if (/[\\/]@tanstack[\\/]/.test(id)) return 'vendor-tanstack';
          if (/[\\/]recharts[\\/]|[\\/]d3-/.test(id)) return 'vendor-charts';
          if (/[\\/]monaco-editor[\\/]|[\\/]codemirror[\\/]/.test(id)) return 'vendor-editor';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          if (/[\\/]@radix-ui[\\/]/.test(id)) return 'vendor-radix';
          if (/[\\/]@objectstack[\\/]/.test(id)) return 'vendor-objectstack';
          return 'vendor';
        },
      },
    },
  },
});

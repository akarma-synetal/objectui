import { defineStack } from '@objectstack/spec';

/**
 * ObjectUI in-repo debug backend.
 *
 * This config is intentionally minimal: it exists only to give `apps/console`
 * a real, schema-driven ObjectStack server to talk to during local
 * development, so contributors do not need to clone or run the `framework`
 * repository in parallel.
 *
 * Do NOT add production-grade objects, business logic, or third-party
 * adapters here. Heavy fixtures belong in dedicated examples under
 * `examples/`.
 */
export default defineStack({
  manifest: {
    id: 'org.objectui.dev',
    namespace: 'objectui_dev',
    version: '0.1.0',
    type: 'app',
    name: 'ObjectUI Dev Backend',
    description: 'Minimal in-repo backend for debugging @object-ui/console.',
  },
  objects: {
    demo: {
      label: 'Demo',
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        description: { type: 'textarea', label: 'Description' },
        status: {
          type: 'select',
          label: 'Status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived' },
          ],
          defaultValue: 'draft',
        },
      },
    },
  },
});

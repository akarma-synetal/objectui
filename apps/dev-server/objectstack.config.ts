import { defineStack } from '@objectstack/spec';

/**
 * ObjectUI in-repo debug backend.
 *
 * This config is intentionally minimal: it exists only to give `apps/console`
 * a real, schema-driven ObjectStack server to talk to during local
 * development, so contributors do not need to clone or run the `framework`
 * repository in parallel.
 *
 * The fixtures below (Customer, Order, Task) are NOT business code —
 * they exist so the renderer matrix (grid / form / kanban / dashboard)
 * has plausible data shapes to exercise during manual QA. Do not
 * extend them with production-grade logic; heavy fixtures belong in
 * dedicated examples under `examples/`.
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
    customer: {
      label: 'Customer',
      pluralLabel: 'Customers',
      icon: 'users',
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        email: { type: 'email', label: 'Email' },
        phone: { type: 'phone', label: 'Phone' },
        tier: {
          type: 'select',
          label: 'Tier',
          options: [
            { label: 'Free', value: 'free' },
            { label: 'Pro', value: 'pro' },
            { label: 'Enterprise', value: 'enterprise' },
          ],
          defaultValue: 'free',
        },
        active: { type: 'boolean', label: 'Active', defaultValue: true },
        notes: { type: 'textarea', label: 'Notes' },
      },
    },
    order: {
      label: 'Order',
      pluralLabel: 'Orders',
      icon: 'shopping-cart',
      fields: {
        code: { type: 'text', label: 'Order #', required: true },
        customer_name: { type: 'text', label: 'Customer' },
        amount: { type: 'currency', label: 'Amount' },
        status: {
          type: 'select',
          label: 'Status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Paid', value: 'paid' },
            { label: 'Refunded', value: 'refunded' },
          ],
          defaultValue: 'draft',
        },
        placed_at: { type: 'datetime', label: 'Placed At' },
      },
    },
    task: {
      label: 'Task',
      pluralLabel: 'Tasks',
      icon: 'check-square',
      fields: {
        title: { type: 'text', label: 'Title', required: true },
        description: { type: 'textarea', label: 'Description' },
        priority: {
          type: 'select',
          label: 'Priority',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ],
          defaultValue: 'medium',
        },
        status: {
          type: 'select',
          label: 'Status',
          options: [
            { label: 'Todo', value: 'todo' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Done', value: 'done' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          defaultValue: 'todo',
        },
        due_date: { type: 'date', label: 'Due Date' },
        completed: { type: 'boolean', label: 'Completed', defaultValue: false },
      },
    },
  },
  apps: {
    dev: {
      label: 'Dev Sandbox',
      description: 'Fixture app for debugging the runtime console.',
      icon: 'flask-conical',
      isDefault: true,
      navigation: [
        {
          id: 'group_crm',
          type: 'group',
          label: 'CRM',
          icon: 'briefcase',
          children: [
            { id: 'nav_customers', type: 'object', label: 'Customers', objectName: 'customer', icon: 'users' },
            { id: 'nav_orders', type: 'object', label: 'Orders', objectName: 'order', icon: 'shopping-cart' },
          ],
        },
        {
          id: 'group_work',
          type: 'group',
          label: 'Work',
          icon: 'kanban',
          children: [
            { id: 'nav_tasks', type: 'object', label: 'Tasks', objectName: 'task', icon: 'check-square' },
          ],
        },
      ],
    },
  },
});

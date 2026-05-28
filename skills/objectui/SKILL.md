---
name: objectui
description: Universal Server-Driven UI (SDUI) Engine for building JSON-driven React interfaces with Shadcn design quality. Use this skill for all ObjectUI development tasks including schema-driven page building, plugin development, component integration, testing, auth/permissions, data integration, i18n, mobile responsiveness, project setup, and console development. Triggers on any mention of ObjectUI, SchemaRenderer, JSON schemas, SDUI, metadata-driven UIs, or Object Stack ecosystem work.
user-invocable: false
---

# ObjectUI

> **A Universal, Server-Driven UI (SDUI) Engine built on React + Tailwind + Shadcn.**

ObjectUI renders JSON metadata from the `@objectstack/spec` protocol into pixel-perfect, accessible, and interactive enterprise interfaces (Dashboards, Kanbans, CRUDs, Forms, Grids).

**Repository:** [github.com/objectstack-ai/objectui](https://github.com/objectstack-ai/objectui)

## Strategic Positioning

- **The "JSON-to-Shadcn" Bridge:** The only library combining Low-Code speed with Shadcn/Tailwind design quality
- **The "Face" of ObjectStack:** Official renderer for the ecosystem, while remaining **Backend Agnostic**

## Core Principles

### 0. English-Only Codebase

**Context:** This is an international open-source project.

**Instruction:** ALL user-facing text in components, documentation, comments, and UI labels MUST be written in English.

**Constraint:** Do NOT use Chinese or any other non-English language in:
- Component text/labels (buttons, titles, descriptions, error messages)
- Code comments
- Documentation files (README.md, docs/*.md)
- Console/log messages

**Reasoning:** English ensures global accessibility and consistency across the codebase.

### 1. Strict Adherence to @objectstack/spec

**Context:** We are the implementation of a standard protocol.

**Instruction:** All component schemas, JSON structures, and data types MUST strictly follow definitions in `@objectstack/spec`.

**Constraint:** Do not invent new schema properties. If the spec says `columns`, do not use `fields`.

**Validation:** Check `@objectstack/spec` definitions before writing any `interface` or `type`.

### 2. Protocol Agnostic (The Universal Adapter)

**Context:** Users might fetch data from a legacy SOAP API or a local JSON file.

**Instruction:** Never hardcode `objectql.find()`. Use the DataSource Interface.

**Pattern:** Inject dataSource via the root `<SchemaRendererProvider dataSource={...} />`.

### 3. Documentation Driven Development

**Context:** Code without docs is dead code.

**Instruction:** For EVERY feature implemented or refactored, you MUST update the corresponding documentation:
1. Package `README.md`
2. `content/docs/guide/*.md`

**Definition of Done:** The task is not complete until the documentation reflects the new code/architecture.

### 4. "Shadcn Native" Aesthetics

**Identity:** We are essentially "Serializable Shadcn".

**Instruction:** When implementing a component (e.g., Card), strictly follow Shadcn's DOM structure (CardHeader, CardTitle, CardContent).

**Constraint:** ALWAYS expose `className` in the schema props. Allow users to inject `bg-red-500` via JSON to override default styles.

### 5. The Action System (Interactivity)

**Concept:** A static UI is useless. The JSON must define behavior.

**Pattern:** Actions are defined as data, not functions.

**Example JSON:**
```json
{
  "events": {
    "onClick": [
      { "action": "validate", "target": "form_1" },
      { "action": "submit", "target": "form_1" },
      { "action": "navigate", "params": { "url": "/success" } }
    ]
  }
}
```

**Implementation:** The `@object-ui/core` package acts as an Event Bus to dispatch these actions.

### 6. Layout as Components

**Concept:** Layouts are just components that render children.

**Instruction:** Treat Grid, Stack, Container as first-class citizens.

**Responsiveness:** Layout schemas must support responsive props (e.g., `cols: { sm: 1, md: 2, lg: 4 }`).

### 7. Type Safety over Magic

- **No `any`:** Use strict Generics.
- **Registry:** Use a central ComponentRegistry to map strings (`"type": "button"`) to React components.
- **No `eval()` or dynamic imports** for security.

### 8. The "No-Touch" Zones (Shadcn Purity)

**Protected Path:** `packages/components/src/ui/**/*.tsx`

**Rule:** You are FORBIDDEN from modifying the logic or styles of files in this directory.

**Reasoning:** These are upstream 3rd-party files that are overwritten by sync scripts.

**Workaround:** If a user asks to change the behavior of Button or Dialog:
1. Do NOT edit `src/ui/button.tsx`.
2. Create or Edit a wrapper in `packages/components/src/custom/`.
3. Import the primitive from `@/ui/...` and wrap it.

## Tech Stack (Strict Constraints)

- **Core:** React 18+ (Hooks), TypeScript 5.0+ (Strict)
- **Styling:** Tailwind CSS (Utility First)
  - ✅ REQUIRED: Use `class-variance-authority` (cva) for component variants
  - ✅ REQUIRED: Use `tailwind-merge` + `clsx` (`cn()`) for class overrides
  - ❌ FORBIDDEN: Inline styles (`style={{}}`), CSS Modules, Styled-components
- **UI Primitives:** Shadcn UI (Radix UI) + Lucide Icons
- **State Management:** Zustand (for global store), React Context (for scoped data)
- **Testing:** Vitest + React Testing Library

## Architecture & Monorepo Topology

You manage a strict PNPM Workspace.

#### Core layers

| Package | Role | Responsibility | 🔴 Strict Constraints |
|---|---|---|---|
| `@object-ui/types` | The Protocol | Pure JSON Interfaces (ComponentSchema, ActionSchema). | ZERO dependencies. No React code. |
| `@object-ui/core` | The Engine | Schema Registry, Validation, Expression Evaluation, Action Engine, Plugin System. | No UI library dependencies. Logic Only. |
| `@object-ui/components` | The Atoms | Shadcn Primitives (Button, Badge, Card) & Icons. | Pure UI. No business logic. |
| `@object-ui/fields` | The Inputs | Standard Field Renderers (Text, Number, Select). | Must implement FieldWidgetProps. |
| `@object-ui/layout` | The Shell | Page Structure (Header, Sidebar, AppShell). | Routing-aware composition. |
| `@object-ui/react` | The Runtime | `<SchemaRenderer>`, hooks, spec bridge, `LazyPluginLoader`. | Bridges Core and Components. |

#### Integration layer (third-party / console embedders)

| Package | Role | Responsibility |
|---|---|---|
| `@object-ui/app-shell` | Minimal Shell | Framework-agnostic `AppShell`, `ObjectRenderer`, `DashboardRenderer`, `PageRenderer`, `FormRenderer`. Bring-your-own-router. |
| `@object-ui/providers` | Context Stack | Reusable `DataSourceProvider`, `MetadataProvider`, `ThemeProvider`. Console-free. |
| `@object-ui/runner` | Universal Runtime | Standalone runtime + dev server for schema-driven apps. Pre-wires popular plugins. |
| `@object-ui/data-*` | Data Adapters | Connectors for REST, ObjectQL, GraphQL (e.g. `@object-ui/data-objectstack`). |

#### Platform features (opt-in)

| Package | Role |
|---|---|
| `@object-ui/auth` | `AuthProvider`, `useAuth`, `AuthGuard`, login/signup forms, `createAuthenticatedFetch`. |
| `@object-ui/permissions` | RBAC engine, `PermissionProvider`, object/field/row-level permission guards. |
| `@object-ui/tenant` | Multi-tenancy: `TenantProvider`, scoped queries, per-tenant branding. |
| `@object-ui/i18n` | i18n: 10+ language packs, RTL, date/currency formatters. |
| `@object-ui/mobile` | Mobile/PWA: responsive primitives, touch gestures, install prompts. |
| `@object-ui/collaboration` | Realtime: presence, live cursors, comment threads, conflict resolution. |

#### Plugins (heavy / specialized widgets)

| Plugin | Purpose |
|---|---|
| `@object-ui/plugin-grid` | Schema-driven data grid (sorting, filtering, virtualization). |
| `@object-ui/plugin-list` / `plugin-detail` / `plugin-form` | List, Detail, Form view renderers. |
| `@object-ui/plugin-kanban` | Drag-and-drop kanban boards. |
| `@object-ui/plugin-calendar` / `plugin-timeline` / `plugin-gantt` | Time-based views. |
| `@object-ui/plugin-dashboard` / `plugin-report` | Dashboards and reports. |
| `@object-ui/plugin-charts` | Chart rendering (recharts-based). |
| `@object-ui/plugin-map` | Map widgets. |
| `@object-ui/plugin-editor` / `plugin-markdown` | Rich text + markdown editors. |
| `@object-ui/plugin-view` | View switcher / saved views. |
| `@object-ui/plugin-designer` | Visual schema designer canvas. |
| `@object-ui/plugin-workflow` | Workflow / process editor. |
| `@object-ui/plugin-ai` / `plugin-chatbot` | AI assistant + chatbot UI. |

#### Tooling

| Package | Purpose |
|---|---|
| `@object-ui/cli` | `objectui` CLI: `init`, `dev`, `build`, `start`, `studio`, `validate`, `check`, `lint`, `test`, `generate`, `add`, `doctor`, `analyze`, `create plugin`. |
| `@object-ui/create-plugin` | `pnpm create-plugin <name>` scaffolder for new `plugin-*` packages. |
| `@object-ui/vscode-extension` | VSCode extension: syntax highlighting, IntelliSense, validation for ObjectUI JSON schemas. |

### Architectural Strategy (Strict)

**❌ Do NOT create a package for every component.**

**✅ Group by Dependency Weight:**

1. **Atoms (@object-ui/components):** Shadcn Primitives. Zero heavy 3rd-party deps.
2. **Fields (@object-ui/fields):** Standard Inputs.
3. **Layouts (@object-ui/layout):** Page Skeletons.
4. **Plugins (@object-ui/plugin-*):** Heavy Widgets (>50KB) or specialized libraries (Maps, Editors, Charts).

**✅ Choose the right integration package:**

- **Building the full ObjectUI Console?** → use `apps/console` patterns (see `guides/console-development.md`).
- **Embedding ObjectUI into a third-party React app with your own router/shell?** → use `@object-ui/app-shell` + `@object-ui/providers`.
- **Running a schema as a standalone app?** → use `@object-ui/runner` or the `objectui` CLI.
- **Custom rendering only (no shell)?** → use `@object-ui/react` (`SchemaRenderer`) directly.

## The JSON Protocol Specification (The "DNA")

You must enforce a strict JSON structure. Every node in the UI tree follows this shape:

```typescript
// @object-ui/types
interface UIComponent {
  /** The unique identifier for the renderer registry (e.g., 'input', 'grid', 'card') */
  type: string;

  /** Unique ID for DOM accessibility and event targeting */
  id?: string;

  /** Visual properties (mapped directly to Shadcn props) */
  props?: Record<string, any>;

  /** Data binding path (e.g., 'user.address.city') */
  bind?: string;

  /** Styling overrides (Tailwind classes) */
  className?: string;

  /** Dynamic Behavior */
  hidden?: string; // Expression: "${data.role != 'admin'}"
  disabled?: string; // Expression

  /** Event Handlers */
  events?: Record<string, ActionDef[]>; // onClick -> [Action1, Action2]

  /** Layout Slots */
  children?: UIComponent[];
}
```

## Quick Reference

### When to Use Specific Guides

The guides in `guides/` provide deep domain expertise:

- **Page Building & Schema Design** → [guides/page-builder.md](./guides/page-builder.md)
- **Creating Custom Plugins** → [guides/plugin-development.md](./guides/plugin-development.md)
- **Expression Syntax & Debugging** → [guides/schema-expressions.md](./guides/schema-expressions.md)
- **Data Fetching & DataSource** → [guides/data-integration.md](./guides/data-integration.md)
- **New Project Setup (CLI, Vite, Tailwind, Runner)** → [guides/project-setup.md](./guides/project-setup.md)
- **Testing Components & Schemas** → [guides/testing.md](./guides/testing.md)
- **Multi-Language Support** → [guides/i18n.md](./guides/i18n.md)
- **Mobile & Responsive Design** → [guides/mobile.md](./guides/mobile.md)
- **Auth, Roles, Tenants & Permissions** → [guides/auth-permissions.md](./guides/auth-permissions.md)
- **Console Development (apps/console patterns, app-shell, providers)** → [guides/console-development.md](./guides/console-development.md)

### Critical Global Rules

The rules in `rules/` define non-negotiable constraints:

- **JSON Protocol Compliance** → [rules/protocol.md](./rules/protocol.md)
- **Styling & Tailwind Usage** → [rules/styling.md](./rules/styling.md)
- **Component Composition Patterns** → [rules/composition.md](./rules/composition.md)
- **No-Touch Zones (Shadcn Upstream)** → [rules/no-touch-zones.md](./rules/no-touch-zones.md)

## Implementation Patterns

### Pattern A: The Component Registry (Extensibility)

How do we let users add their own "Map" component?

```typescript
// packages/core/src/registry.ts
export type ComponentImpl = React.FC<{ schema: any; ... }>;

const registry = new Map<string, ComponentImpl>();

export function registerComponent(type: string, impl: ComponentImpl) {
  registry.set(type, impl);
}

export function resolveComponent(type: string) {
  return registry.get(type) || FallbackComponent;
}
```

### Pattern B: The Renderer Loop (Recursion)

How to render a tree?

```typescript
// packages/react/src/SchemaRenderer.tsx
export const SchemaRenderer = ({ schema }: { schema: UIComponent }) => {
  const Component = resolveComponent(schema.type);
  const { isHidden } = useExpression(schema.hidden);

  if (isHidden) return null;

  return (
    <Component
      schema={schema}
      className={cn(schema.className)}
      {...schema.props}
    >
      {schema.children?.map(child => (
        <SchemaRenderer key={child.id} schema={child} />
      ))}
    </Component>
  );
};
```

## AI Workflow Instructions

### On "Create New Component" (e.g., 'DataTable')

1. **Type Definition:** Update `@object-ui/types`. Define `DataTableSchema` (columns, sorting, pagination).
2. **Shadcn Mapping:** Look at shadcn/ui/table. Create `DataTableRenderer` in `@object-ui/components`.
3. **Data Scope:** Use `useDataScope()` to get the array data. Do not fetch data inside the component.
4. **Registration:** Register `"type": "table"` in the core registry.

### On "Action Logic" (e.g., 'Open Modal')

1. **Define Schema:** Add `OpenModalAction` interface to types.
2. **Implement Handler:** Add the logic to the ActionEngine in `@object-ui/core`.
3. **Visuals:** Ensure the component triggering it calls `useActionRunner()`.

### On "Documentation"

1. **JSON First:** Always show the JSON configuration first.
2. **Visuals:** Describe how Tailwind classes (`className`) affect the component.

## Debugging & Browser Simulation Strategy

When debugging the simulated browser environment (e.g., `apps/console` in mock mode), strict adherence to the official toolchain is required.

### Rule #1: Official MSW Integration

- **Startup:** Use `@objectstack/plugin-msw` to initialize the mock API server. Do NOT write custom fetch interceptors or manual mock servers unless absolutely necessary.
- **Configuration:** Ensure the `MSWPlugin` is configured with the correct `baseUrl` (e.g., `/api/v1`) to match the client's expectations.

### Rule #2: Client Data Fetching

- **Data Access:** Always use `@objectstack/client` for data fetching. Do not use raw `fetch` or `axios` directly in components.
- **Alignment:** Verify that the client's `baseUrl` matches the mock server's configuration.

### Rule #3: Upstream Fixes First

- **Principle:** If you encounter a bug or limitation in the official packages (`@objectstack/*`):
  - **Action 1:** Do NOT rely solely on local workarounds (monkey-patching) in the app.
  - **Action 2:** Prompt the user to modify the source code in the official packages (if available in the workspace) or report the issue.
  - **Reasoning:** We prioritize fixing the core engine over patching individual apps.

## Common Mistakes to Avoid

- Writing large bespoke React JSX trees before schema definition
- Hardcoding API calls directly inside visual renderers
- Introducing package coupling (e.g., UI package depending on business logic package)
- Registering components without namespace in plugin-heavy projects
- Skipping docs updates for newly introduced schema patterns
- Putting expression values in top-level `value`/`label` fields instead of `props.*`
- Missing Shadcn CSS variables — components render but look completely unstyled
- Forgetting `@source` directives in Tailwind config — utility classes not generated for ObjectUI packages

## Fast Triage Playbook for Ambiguous Requests

If the request is underspecified:

1. Infer likely page category (list/detail/form/dashboard)
2. Produce a minimal viable schema first
3. Mark assumptions clearly
4. Provide one conservative and one advanced variant

This keeps momentum while inviting focused user feedback.

---

**You are the Architect. Build the Engine.**

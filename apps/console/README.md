# ObjectStack Console

The standard runtime UI for ObjectStack applications. This package provides the **Console** — a full-featured enterprise admin interface that renders from JSON metadata alone, requiring zero custom pages.

> **Version:** 0.5.1 &nbsp;|&nbsp; **Spec:** @objectstack/spec v3.0.7 &nbsp;|&nbsp; [Full Roadmap →](./CONSOLE_ROADMAP.md)

## Features

- **Server-Driven UI**: Renders objects, views, dashboards, reports, and pages from JSON schemas
- **Multi-App Support**: Switch between apps defined in your stack, each with its own branding
- **Plugin Architecture**: 15+ view plugins (grid, kanban, calendar, timeline, chart, map, gantt, gallery, etc.)
- **Expression Engine**: Dynamic visibility, disabled, and hidden expressions evaluated at runtime
- **CRUD Operations**: Create, edit, delete records via schema-driven forms and dialogs
- **Command Palette**: `⌘+K` for quick navigation across apps and objects
- **Dark/Light Theme**: System-aware theme with per-app branding (logo, colors, favicon)
- **Developer Tools**: Built-in metadata inspector with collapsible sections and copy-to-clipboard support

## Quick Start

```bash
# From the repository root
pnpm install

# Start the in-repo backend + the console SPA in parallel
pnpm dev:full

# Build for production
pnpm build

# Run tests
pnpm test
```

`pnpm dev:full` boots two processes:

- **`@object-ui/dev-server`** on `http://localhost:3000` — a thin
  `@objectstack/cli` shell with fixture metadata under `apps/dev-server/`.
  Bundles `@objectstack/account` so `/_account/*` (login, setup,
  org self-service) is mounted on the same origin.
- **`@object-ui/console`** (Vite) on `http://localhost:5180` — pre-wired
  via `.env.development` (`VITE_SERVER_URL=http://localhost:3000`).
  Vite proxies `/api/*` and `/_account/*` to `:3000`.

You can also run them independently with `pnpm dev:server` and `pnpm dev`.

### First-time setup

On a fresh checkout the in-repo SQLite database (`apps/dev-server/.objectstack/data/standalone.db`)
is empty. After `pnpm dev:full` opens the SPA:

1. The console redirects to `/_account/setup` automatically.
2. Create the owner account (e.g. `admin@dev.local` / `password123`).
3. You are logged in and dropped at `/home`.

Reset by deleting `apps/dev-server/.objectstack/` and restarting.

### Environment knobs

The `dev` script in `apps/dev-server/package.json` sets safe defaults
that you can override by exporting your own values before
`pnpm dev:full`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | `dev-secret-…` | Required by `plugin-auth` outside `--dev` mode. **Never** ship the default to production. |
| `OS_TRUSTED_ORIGINS` | `http://localhost:*` | Lets better-auth accept the Vite origin (`:5180`). |
| `OS_DISABLE_STUDIO` | `1` | Skip mounting `/_studio/` (irrelevant for console debugging). |
| `OS_DISABLE_CONSOLE` | `1` | Skip cli-bundled `/_console/` — the SPA under test runs via Vite. |

## Running Modes

The console supports two running modes:

### 1. Development Mode (with in-repo backend)
**Command:** `pnpm dev:full` (or `pnpm dev` if a backend is already up)

- Vite dev server with Hot Module Replacement (HMR), opens at
  http://localhost:5180.
- Talks to the **in-repo** ObjectStack backend at
  http://localhost:3000 (`apps/dev-server`). No external repository
  required.
- Best for UI development and end-to-end debugging.

### 2. Standalone SPA preview
**Command:** `pnpm start`

- Runs `vite preview` against the built `dist/` directory.
- Connects to whatever backend `VITE_SERVER_URL` points at — useful for
  smoke-testing a production build against a remote ObjectStack instance.
- Opens at http://localhost:4173 (Vite preview default).

**Required environment variable** (set in the Vercel project's *Environment Variables* panel):

| Variable | Example | Description |
| --- | --- | --- |
| `VITE_SERVER_URL` | `https://demo.objectstack.ai` | Absolute URL of the ObjectStack backend. When unset, requests default to the same origin — which will 404 on a static SPA host. |

Additional backend requirements for cross-origin deployments:

1. The backend must allow CORS from the SPA origin (`Access-Control-Allow-Origin: <spa-origin>`, `Access-Control-Allow-Credentials: true`).
2. Auth cookies must use `SameSite=None; Secure` so they are sent on cross-site requests.
3. The apps and objects referenced in URLs (e.g. `crm_enterprise`, `lead`) must actually exist in the backend metadata — otherwise the console will render its *object not found* empty state.

## ObjectStack Spec Compliance

### AppSchema Support
- ✅ `name`, `label`, `icon` — Basic app metadata
- ✅ `description`, `version` — Optional app information
- ✅ `homePageId` — Custom landing page configuration
- ✅ `requiredPermissions` — Permission-based access control
- ✅ `branding.logo`, `branding.primaryColor`, `branding.favicon` — App branding

### Navigation Support
- ✅ `object` — Navigate to object list views
- ✅ `dashboard` — Navigate to dashboards
- ✅ `page` — Navigate to custom pages
- ✅ `report` — Navigate to reports
- ✅ `url` — External URL navigation with target support
- ✅ `group` — Nested navigation groups with collapse
- ✅ `visible` / `visibleOn` — Expression-based visibility conditions

### Object Operations
- ✅ Multi-view switching (grid, kanban, calendar, timeline, chart, map, gantt, gallery)
- ✅ Create / Read / Update / Delete via ObjectForm
- ✅ Search, filter, sort across all view types
- ✅ Record detail page and drawer preview
- ✅ Metadata inspector for developers

## Architecture

The console is a thin orchestration layer on top of the ObjectUI plugin system:

```
Console App
├── @object-ui/react          — SchemaRenderer (JSON → Component)
├── @object-ui/components     — Shadcn UI primitives
├── @object-ui/layout         — AppShell, Sidebar
├── @object-ui/core           — ExpressionEvaluator, ActionRunner
├── @object-ui/data-objectstack — API adapter (auto-reconnect, caching)
├── @object-ui/plugin-view    — ObjectView (multi-view container)
├── @object-ui/plugin-form    — ObjectForm (CRUD forms)
├── @object-ui/plugin-grid    — DataGrid (Shadcn-native, virtualized)
├── @object-ui/plugin-kanban  — Kanban board
├── @object-ui/plugin-calendar— Calendar view
├── @object-ui/plugin-dashboard — Dashboard renderer
├── @object-ui/plugin-report  — Report viewer/builder
└── 8 more view plugins...
```

## Documentation

| Document | Description |
|----------|-------------|
| [Console Roadmap](./CONSOLE_ROADMAP.md) | Full development plan with phases, timeline, and verified status |
| [Getting Started Guide](../../content/docs/guide/console.md) | User-facing documentation |
| [Architecture Guide](../../content/docs/guide/console-architecture.md) | Technical deep-dive |
| [UI Improvement Proposal](./docs/UI_IMPROVEMENT_PROPOSAL.md) | Modern UI design improvements for metadata inspector |

## License

MIT

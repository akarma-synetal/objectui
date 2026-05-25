# ObjectStack Studio

The official **ObjectStack Studio** - a metadata-driven admin interface for managing data and configuration.

## 🎯 Overview

ObjectStack Studio provides a modern, responsive admin interface that:

- **Auto-generates UI** from your metadata definitions
- **CRUD Operations** with built-in validation
- **Dynamic Navigation** based on registered objects
- **Real-time Updates** with optimistic UI patterns
- **Dark Mode Support** via shadcn/ui theming

## 🏗️ Architecture

The console supports two runtime modes:

### MSW Mode (Default)

Runs the ObjectStack Runtime directly in the browser using MSW (Mock Service Worker), enabling full offline development.

```mermaid
graph TD
    Console["Console App"] -->|REST API| Network["Browser Network"]
    Network -->|Intercepted by| SW["Service Worker (MSW)"]
    SW -->|Delegates to| Kernel["ObjectStack Kernel"]
    Kernel -->|Uses| Driver["In-Memory Driver"]
    Kernel -.->|Reads| Config["objectstack.config.ts"]
```

### Server Mode

Connects to a real ObjectStack server for production use or integration testing.

```mermaid
graph TD
    Console["Console App"] -->|REST API| Server["ObjectStack Server"]
    Server -->|Processes| Kernel["ObjectStack Kernel"]
    Kernel -->|Uses| Driver["Database Driver"]
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server (MSW mode)
pnpm dev

# Start in server mode (connects to real backend)
VITE_RUNTIME_MODE=server VITE_SERVER_URL=http://localhost:5000/api/v1 pnpm dev
```

The console will be available at `http://localhost:3000`.

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_RUNTIME_MODE` | `msw` | Runtime mode: `msw` or `server` |
| `VITE_SERVER_URL` | `http://localhost:5000/api/v1` | Server URL (server mode only) |

Copy `.env.example` to `.env.local` to customize:

## 📁 Project Structure

```
apps/studio/
├── src/
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Entry point with MSW bootstrap
│   ├── index.css            # Tailwind CSS configuration
│   ├── components/
│   │   ├── app-sidebar.tsx  # Dynamic navigation sidebar
│   │   ├── site-header.tsx  # Page header with breadcrumbs
│   │   ├── ObjectDataTable.tsx  # Auto-generated data tables
│   │   ├── ObjectDataForm.tsx   # Auto-generated forms
│   │   └── ui/              # shadcn/ui components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities
│   └── mocks/               # MSW configuration
├── objectstack.config.ts    # Metadata definitions
└── package.json
```

## 🎨 UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) and Tailwind CSS v4:

- **Sidebar** - Collapsible navigation with object list
- **DataTable** - Sortable, filterable data grid
- **DataForm** - Dynamic form generation from field metadata
- **Toast** - Notification system for user feedback

## 🔧 Configuration

The console reads metadata from `objectstack.config.ts`:

```typescript
import { defineStack } from '@objectstack/spec';
import { ObjectSchema, Field } from '@objectstack/spec/data';

export const Account = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  fields: {
    name: Field.text({ label: 'Name', required: true }),
    industry: Field.select({ 
      label: 'Industry',
      options: ['Technology', 'Finance', 'Healthcare']
    }),
  }
});

export default defineStack({
  objects: [Account]
});
```

## 📦 Dependencies

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Component library
- **MSW** - API mocking for development
- **@objectstack/client** - API client
- **@objectstack/runtime** - In-browser kernel

## 🛠️ Development

```bash
# Type checking
pnpm typecheck

# Run tests
pnpm test

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 🚀 Performance — lazy AI chat

`AiChatPanel` is **lazy-loaded** (`React.lazy` + dynamic import in
`src/routes/__root.tsx`) and only mounts when the user actually toggles
the AI panel open. Because `@object-ui/plugin-chatbot` pulls in `shiki`
(syntax-highlighting grammars ≈ 19 MB), `streamdown`, `mermaid`, and
`katex`, keeping the panel behind a lazy boundary cuts first-paint
vendor JS from ~23 MB to ~2.5 MB.

The build's `manualChunks` (in `vite.config.ts`) routes these heavy
deps to dedicated chunks so the dependency graph still resolves them
lazily even when Vite's automatic code-splitting would otherwise inline
them:

| Chunk | Contents | When loaded |
|---|---|---|
| `vendor-chat-shiki` | Shiki + bundled grammars | AI panel open |
| `vendor-chat-streamdown` | Streaming markdown renderer | AI panel open |
| `vendor-chat-diagrams` | Mermaid + KaTeX + Cytoscape | AI panel open |
| `vendor-chat-ui` | `@object-ui/plugin-chatbot` itself | AI panel open |
| `vendor-ai-sdk` | `@ai-sdk/*`, `ai` | AI panel open |
| `AiChatPanel-*` | The wrapper component | AI panel open |
| `vendor` | Everything else (Studio core) | first paint |

If you add new chat-only deps, mirror them in `vite.config.ts`'s
`manualChunks` to keep first paint clean.

## 🎨 Recent UX touches

| Surface | Behaviour |
|---|---|
| **Theme toggle** (`src/components/theme-toggle.tsx`) | Persists `light` / `dark` / `system` to `localStorage` under `'theme'`, mirrored by an inline pre-React script in `index.html` to avoid FOUC. In `system` mode a `matchMedia('(prefers-color-scheme: dark)')` listener re-applies the class when the OS theme flips. The dropdown uses `RadioGroup` so the active mode is visibly checked. |
| **Breadcrumb labels** (`src/components/top-bar.tsx`) | Read from a single registry in `src/components/studio-nav.ts` (`navLabelByKey`, `pluralTypeLabel`, `BREADCRUMB_LABELS`, `METADATA_TYPE_PLURAL_LABELS`). When i18n lands, replace those constants with `t(...)` calls in one file instead of three. |
| **Object cards** (`src/components/MetadataListPage.tsx`) | Show `N fields  N records` chips on object cards in list pages. Field count comes from the loaded spec; record count is a best-effort `client.data.find(name, { limit: 1 })` fired in parallel after the row list resolves — failures simply hide the chip. |
| **Related-items chip** (`src/routes/$package.objects.$name.tsx`) | Inline `Sparkles + N related` chip in the object-hub header instead of a full-width discovery banner. Click to jump to the Related tab. |

## 📄 License

MIT - See [LICENSE](../../LICENSE) for details.

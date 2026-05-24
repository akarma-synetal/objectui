# @object-ui/dev-server

In-repo ObjectStack backend used to debug `@object-ui/console` without
depending on an external `framework` checkout.

This package is a thin shell around `@objectstack/cli` (`objectstack serve`)
plus a minimal metadata fixture. It exists for **one reason only**: give
contributors a single-repo `pnpm install && pnpm dev:full` workflow.

> ❗ Architectural intent: ObjectUI is **backend agnostic** (see Rule #1 in
> `AGENTS.md`). This dev-server is a debug fixture, not a runtime dependency
> of any published `@object-ui/*` package. Renderers must never import from
> here.

## Usage

From the repository root:

```bash
# Start backend + console SPA in parallel
pnpm dev:full

# Or, run them separately:
pnpm dev:server   # backend on http://localhost:3000
pnpm dev          # console on http://localhost:5173
```

The console (`apps/console`) is pre-configured via
`.env.development` → `VITE_SERVER_URL=http://localhost:3000`, so no extra
wiring is required.

## How it works

`pnpm dev` first runs `objectstack build` to compile
`objectstack.config.ts` into `dist/objectstack.json`, then starts
`objectstack serve` from that artifact. Going through the artifact
sidesteps an upstream `cli` issue where loading the TS config directly
via `serve --dev` fails with `Service 'manifest' is async - use await`.

### Environment variables baked into `pnpm dev`

| Variable | Default | Why |
| --- | --- | --- |
| `AUTH_SECRET` | `dev-secret-do-not-use-in-prod-…` | `plugin-auth` is otherwise skipped in production mode |
| `OS_TRUSTED_ORIGINS` | `http://localhost:*` | Lets the Vite-served console (e.g. `:5180`) pass better-auth's `INVALID_ORIGIN` check |
| `OS_DISABLE_STUDIO` | `1` | We don't need the Studio designer for console debugging |
| `OS_DISABLE_CONSOLE` | `1` | The cli-bundled Console at `/_console/` is suppressed — the SPA under test runs via Vite |

Each can be overridden by exporting the same name before `pnpm dev:full`.

### Why `@objectstack/account` is a dep

The runtime Console hard-redirects unauthenticated users to
`/_account/login` (served by the framework's account portal). To keep
the dev loop fully self-contained we ship `@objectstack/account` as a
dep — the cli auto-detects its pre-built `dist/` in `node_modules` and
mounts it at `/_account/*`. Vite proxies `/_account` to `:3000`.

## What lives here

| File | Purpose |
| --- | --- |
| `objectstack.config.ts` | `defineStack` entry consumed by `objectstack serve` (objects live here inline using the map format) |

## What does NOT live here

- Business logic, real customer data, production drivers.
- Anything imported by code under `packages/` or `apps/console`.

Larger demo datasets belong under `examples/`.

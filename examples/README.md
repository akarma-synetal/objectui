# ObjectUI Examples

Runnable examples that show how to consume ObjectUI in different scenarios. Pick the one that matches your starting point.

## Which example should I use?

| Example | Use it when… | Backend | Bundle | What it gives you |
|---|---|---|---|---|
| [`hello-world/`](./hello-world) | You want the smallest possible `<SchemaRenderer>` demo to see the JSON → React pipeline. | None (in-memory schema) | Tiny | A single `App.tsx` rendering one schema. |
| [`byo-backend-console/`](./byo-backend-console) | You want to **embed** ObjectUI into your own app and connect it to **your own** REST/GraphQL backend. | Bring-your-own (mock REST shown) | ~50 KB | `@object-ui/app-shell` + `@object-ui/providers`, custom router, custom `DataSource`. ~100 lines of integration code, no auth, no plugins. |
| [`console-starter/`](./console-starter) | You want a **fork-ready, opinionated console** with the full plugin set already wired against an **ObjectStack** backend. | ObjectStack (`/api/v1`) | Full | `@object-ui/app-shell` `ConsoleShell` + `AuthProvider` + every `@object-ui/plugin-*` (grid, kanban, calendar, charts, dashboard, designer, detail, form, list, report, view, chatbot). |

> **Rule of thumb:**
> - Learning the rendering protocol → `hello-world`.
> - Adding ObjectUI to an existing product / different backend → `byo-backend-console`.
> - Standing up a brand-new ObjectStack console → fork `console-starter`.

## Running an example

From the monorepo root:

```bash
pnpm install
pnpm -w build
cd examples/<name>
pnpm dev
```

Each example exposes its own dev server port (see its README).

## Adding a new example

1. Create `examples/<name>/` with `package.json` named `@object-ui/example-<name>`.
2. Mark it `private: true`.
3. Add an entry to the table above and link its README.
4. Reference workspace packages with `workspace:*`.
5. Keep the dependency footprint aligned with the example's purpose — heavy plugins belong in `console-starter`, not in lightweight integration demos.

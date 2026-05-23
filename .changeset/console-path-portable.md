---
'@object-ui/console': patch
---

Make the published Console SPA path-portable. Build with relative Vite
base (`./`) and derive the React Router basename from `document.baseURI`
at runtime, so the same `dist/` works at any mount path (`/_console/`,
`/console/`, `/foo/bar/`). Hosts should inject `<base href="/path/">`
into the served HTML — the framework CLI does this automatically.

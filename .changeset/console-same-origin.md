---
'@object-ui/console': patch
---

Fix self-host blank page: clear `VITE_SERVER_URL` in `.env.production`
so the published SPA defaults to same-origin instead of baking in
`https://demo.objectstack.ai`. CORS-blocked auth/i18n/discovery calls
were preventing the SPA from rendering when embedded in any host other
than the demo deployment. Demo-only deployments now inject
`VITE_SERVER_URL` at deploy time.

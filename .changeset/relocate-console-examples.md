---
'@object-ui/app-shell': patch
'@object-ui/components': patch
---

chore(examples): relocate console templates under `examples/`

The fork-ready ObjectStack console template moved from `apps/console-starter`
to `examples/console-starter`, so `apps/` only contains real deployable
products (`console`, `site`). The third-party integration demo
`examples/minimal-console` was renamed to `examples/byo-backend-console`
to make its "bring-your-own backend" purpose explicit and to remove the
naming collision with the starter template. Source comments and READMEs in
`@object-ui/app-shell` and `@object-ui/components` have been updated to
point at the new paths; no runtime behaviour changed. A new
`examples/README.md` provides a "which example should I use?" selector.

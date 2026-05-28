---
'@object-ui/core': minor
'@object-ui/react': minor
'@object-ui/app-shell': minor
---

Add resultDialog + target interpolation for one-shot action reveals

Some platform actions return values the user MUST copy now because the
server will not surface them again — 2FA TOTP URI + backup codes, freshly
minted OAuth client_secret, regenerated recovery codes. Previously these
had to ship as bespoke pages in `apps/account` because actions only
emitted a fire-and-forget toast.

**`@object-ui/core` — ActionRunner**

- New `ActionDef.resultDialog: ResultDialogSpec` field. When set on a
  successful action, the runner suppresses the `successMessage` toast and
  awaits the registered `ResultDialogHandler` instead. Missing handler is
  non-fatal (logs a warning); rejected handler is treated as acknowledged.
- New `setResultDialogHandler(handler)` setter.
- New types: `ResultDialogSpec`, `ResultDialogFieldSpec`,
  `ResultDialogHandler`.
- `executeUrl` and `executeAPI` now run `${param.X}` and `${ctx.X}`
  interpolation against `target` before fetching / navigating. Values are
  `encodeURIComponent`'d, missing keys resolve to empty string. `ctx`
  exposes `origin`, `user`, `org`, `recordId` by default; consumers can
  inject more via `context.ctx`.

**`@object-ui/react`**

- `ActionProvider` and `useActionRunner` both gained an `onResultDialog`
  option that wires straight through to the runner.

**`@object-ui/app-shell`**

- New `ActionResultDialog` component — promise-based, blocks click-outside
  and Escape (the user MUST click acknowledge), renders five field
  formats: `qrcode` (client-side via the `qrcode` package — never sent
  off-device, so 2FA URIs stay secret), `code-list`, `secret`, `text`,
  `json`. Falls back to `json` when a value's shape doesn't match its
  declared format.
- `ObjectView` and `RecordDetailView` install the handler and mount the
  dialog automatically, so any action with `resultDialog` declared in
  metadata now works without code changes.
- New dependency: `qrcode@^1.5.x` for client-side QR rendering.

Pairs with the framework-side `Action.resultDialog` schema added in
`@objectstack/spec` and the `sys_two_factor` / `sys_oauth_application` /
`sys_account` updates in `@objectstack/platform-objects`.

# Third-Party Notices

ObjectUI redistributes a small amount of code from other open-source
projects. The following list tracks those components, their upstream
sources, and the licenses they ship under. All entries are MIT-compatible.

---

## Vercel AI Elements

- **Upstream:** <https://elements.ai-sdk.dev/> · <https://registry.ai-sdk.dev>
- **License:** MIT © Vercel, Inc.
- **Vendored into:** `packages/plugin-chatbot/src/elements/*.tsx`
- **Components:** `conversation`, `message`, `prompt-input`, `reasoning`,
  `tool`, `sources`, `suggestion`, `code-block`, `loader`, `shimmer`.
- **Local modifications:**
  - Import paths rewritten from `@/components/ui/*` / `@/lib/utils` /
    `@/registry/new-york-v4/ui/*` → `@object-ui/components`.
  - `Slot.Root` (Radix v2 umbrella) normalised to the v1 `Slot` import.
  - `Array.prototype.at(-1)` replaced with index access for ES2020 lib
    compatibility.
  - Size variant `icon-sm` swapped for `icon` on plain `Button` consumers.
- **Re-sync command:** fetch from `https://registry.ai-sdk.dev/<name>.json`,
  copy the `files[].content` payloads, re-apply the import rewrites above.

## shadcn/ui

- **Upstream:** <https://ui.shadcn.com> · <https://github.com/shadcn-ui/ui>
- **License:** MIT © shadcn.
- **Vendored into:** `packages/plugin-chatbot/src/elements/ui/`
  - `button-group.tsx`
  - `input-group.tsx`
- **Rationale:** these two primitives are not yet shipped under
  `packages/components/src/ui/` but are required by the AI Elements layer.
- **Local modifications:** import path rewrites only (see above).

---

If you add another upstream-sourced file under `packages/`, append it to this
list with the same shape: upstream link, license, files affected, and any
local edits.

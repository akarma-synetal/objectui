---
title: Metadata Diagnostics
description: How ObjectStack surfaces load-time validation problems in Studio.
---

# Metadata Diagnostics

Every metadata item shipped by a package — `object`, `view`, `report`,
`dashboard`, `flow`, `app`, … — is validated against its Zod schema when
the framework loads it. The validation result travels alongside the
item as a `_diagnostics` envelope, and Studio surfaces it at four levels
so authors and operators can fix problems without grepping logs.

> **Backend agnostic.** The shape and the REST endpoint described below
> are part of the ObjectStack protocol. Studio is one consumer; any
> custom UI built on `@object-ui/data-objectstack` can render the same
> envelope.

## The `_diagnostics` envelope

```ts
interface MetadataDiagnostics {
  valid: boolean;
  errors?:   Array<{ path: string; message: string; code?: string }>;
  warnings?: Array<{ path: string; message: string; code?: string }>;
}
```

* `valid === false` means **at least one error** — features that depend
  on the item (rendering, queries, automation) are unsafe to use.
* `warnings[]` is advisory — items remain `valid: true` but operators
  should review (deprecations, performance hints, missing-but-defaultable
  fields).
* `path` is dot-delimited, matching the same convention Zod uses
  (`fields.email.type`, `columns.0.bind`).

The envelope is attached to:

| Endpoint                               | Where the envelope lives          |
|:---------------------------------------|:----------------------------------|
| `GET /api/v1/meta/items/:type`         | Each list entry (`item._diagnostics`) |
| `GET /api/v1/meta/items/:type/:name`   | Top-level (`item._diagnostics`)   |
| `GET /api/v1/meta/items/:type/:name?layered=true` | `effective._diagnostics`    |
| `GET /api/v1/meta/diagnostics`         | Sweep — see next section          |

## The diagnostics sweep endpoint

`GET /api/v1/meta/diagnostics` runs validation across **every metadata
type and item** in one round-trip. It powers the governance overview
page and the per-type tile badges.

```http
GET /api/v1/meta/diagnostics?severity=error
```

| Query        | Default   | Effect                                          |
|:-------------|:----------|:------------------------------------------------|
| `severity`   | `error`   | `error` returns invalid items only; `warning` also returns items with only warnings. |
| `type`       | —         | Limit to a single metadata type.                 |
| `package`    | —         | Limit to one package id.                         |

Response:

```ts
interface MetadataDiagnosticsSummary {
  entries: Array<{
    type: string;
    name: string;
    diagnostics: MetadataDiagnostics;
  }>;
  total: number;          // entries.length
  scannedTypes: number;   // how many metadata types were checked
  scannedItems: number;   // how many items were checked in total
}
```

Use this as a CI gate too — `total === 0` is the green-build condition.

## Studio UI surfaces

### 1. Directory page badges

`/apps/studio/metadata` — each type tile shows a red ⚠ + count when any
items of that type fail validation. The "View all issues (N)" link in
the filter row jumps straight to the governance page.

### 2. Resource list rows

`/apps/studio/metadata/<type>` — invalid rows get a red ⚠ icon next to
the name and a destructive-tinted background; warning-only rows get an
amber ⚠ and amber tint. The list header shows an aggregate "Invalid N"
chip. Hover the ⚠ for the first three messages.

### 3. Resource edit banners

`/apps/studio/metadata/<type>/<name>` — a destructive banner at the top
of the edit page lists the first three errors with their paths; the
same errors are also threaded into the form so the offending fields
get inline messages **without** the user having to click Save first.
Warnings, when present, render as a parallel amber banner.

Edits clear the matching diagnostic immediately — the inline error on a
field disappears as soon as you start typing in it, then re-validates
on save.

### 4. Governance overview page

`/apps/studio/metadata/_diagnostics` — a single sortable table of every
invalid item across every type, grouped by type, with deep-links to the
offending edit page. Toggle the severity tab to include
warning-only items. This is the page to open during a release readiness
review.

## Authoring metadata that validates cleanly

Validation rules are defined by the Zod schemas in `@objectstack/spec`.
A few high-leverage patterns:

* **Use `defineObject`, `defineView`, … helpers** from `@objectstack/spec` —
  TypeScript catches most shape issues at compile time before they ever
  reach the diagnostics path.
* **Run `os check`** locally before publishing. It calls the same
  validators the server uses on load.
* **Treat warnings like errors in CI.** Pass `severity=warning` to the
  sweep endpoint and assert `total === 0`.
* **Layered overlays merge first, then validate.** If only your runtime
  overlay fails, the source artifact is fine — the bad value is in the
  overlay. The edit banner reflects the *effective* item, so what you
  see is what features will get.

## Client SDK

```ts
import { MetadataClient } from '@object-ui/data-objectstack';

const client = new MetadataClient(/* config */);
const summary = await client.diagnostics({ severity: 'error' });
console.log(summary.total, 'invalid item(s)');
```

The hook used by the Studio surfaces:

```ts
import { useGlobalDiagnostics, useMetadataClient } from '@object-ui/app-shell';

const client = useMetadataClient();
const { loading, error, summary, byType, reload } =
  useGlobalDiagnostics(client, 'error');
```

`byType` is `Record<typeId, number>` — the per-type invalid count used
by the directory tile badge.

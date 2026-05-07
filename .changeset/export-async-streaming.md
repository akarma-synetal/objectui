---
'@object-ui/types': minor
'@object-ui/components': minor
'@object-ui/plugin-grid': minor
---

Async streaming export — spec v4 export job lifecycle end-to-end

For tenants with millions of records the legacy in-memory CSV/JSON export blew
past the browser's heap. This change wires the spec v4 streaming-export
contract through the renderer end-to-end:

**`@object-ui/types`** — `DataSource` gains four optional methods:

- `createExportJob(resource, request)` → `{ jobId, status, estimatedRecords, createdAt }`
- `getExportJobProgress(jobId)` → `{ status, processedRecords, totalRecords, percentComplete, downloadUrl, … }`
- `cancelExportJob(jobId)` (optional)
- `getExportJobDownloadUrl(jobId)` (optional — for short-lived signed URLs)

Mirror the spec v4 `CreateExportJobRequest` / `ExportJobProgress` shapes; types
remain dependency-free.

**`@object-ui/components`** — new public API:

- `useExportJob({ dataSource, pollIntervalMs, onComplete, onError })` — owns the
  full polling loop, terminal-state handling, cancel, and download.
- `<ExportProgressDialog open onOpenChange job filename closeAfterDownloadMs />` —
  determinate or indeterminate progress bar, byte/record counts, Cancel while
  running, Download on completion, error banner on failure.

**`@object-ui/plugin-grid`** — `ObjectGrid` now auto-detects async export
support: when the `DataSource` exposes `createExportJob` + `getExportJobProgress`
(and the schema isn't using inline `value` data) the export popover routes
through the streaming path with a progress dialog. Otherwise it falls back to
the existing client-side blob path. Set `exportOptions.streaming = false` to
force the legacy path.

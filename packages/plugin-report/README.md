# @object-ui/plugin-report

Report components for Object UI — build, view, render, and export reports with scheduling support.

## Features

- 📊 **Report Builder** - Visual drag-and-drop report construction
- 👁️ **Report Viewer** - Interactive report viewing with toolbar controls
- 🎨 **Type-aware cells** - select → Badge, lookup → link, boolean → ✓/✗, email/url/phone → mailto/external/tel links, image → thumbnail, etc. (auto-hydrated from object metadata)
- 🖨️ **Report Renderer** - Render reports from JSON definitions with charts
- 📤 **Multi-Format Export** - Export to CSV, JSON, HTML, PDF, and Excel
- 🔄 **Live Data Export** - Export with real-time data via `exportWithLiveData`
- 📈 **Excel Formulas** - Export Excel files with live formulas via `exportExcelWithFormulas`
- ⏰ **Schedule Config** - Configure recurring report generation and delivery
- 📦 **Auto-registered** - Components register with `ComponentRegistry` on import

## Installation

```bash
npm install @object-ui/plugin-report
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `@object-ui/core`

## Quick Start

```tsx
import { ReportBuilder, ReportViewer, ReportRenderer } from '@object-ui/plugin-report';

function ReportEditorPage() {
  return <ReportBuilder report={initialReport} />;
}

function ReportViewPage() {
  return <ReportViewer report={reportDefinition} showToolbar />;
}

function EmbeddedReport() {
  return (
    <ReportRenderer
      title="Monthly Sales"
      description="Sales performance overview"
      chart={chartConfig}
    />
  );
}
```

## API

### ReportBuilder

Visual report construction interface:

```tsx
<ReportBuilder report={initialReport} />
```

### ReportViewer

Interactive report viewer with toolbar:

```tsx
<ReportViewer report={reportDefinition} showToolbar />
```

### ReportRenderer

Renders a report from a JSON chart configuration:

```tsx
<ReportRenderer title="Revenue" description="Q4 Revenue" chart={chartConfig} />
```

### Export Functions

Export reports in multiple formats:

```tsx
import {
  exportReport,
  exportAsCSV,
  exportAsJSON,
  exportAsHTML,
  exportAsPDF,
  exportAsExcel,
} from '@object-ui/plugin-report';

await exportAsCSV(reportData, 'sales-report.csv');
await exportAsPDF(reportData, 'sales-report.pdf');
await exportAsExcel(reportData, 'sales-report.xlsx');
```

### Live Export

Export with real-time data and Excel formulas:

```tsx
import { exportWithLiveData, exportExcelWithFormulas } from '@object-ui/plugin-report';

await exportWithLiveData(reportConfig, { format: 'pdf' });
await exportExcelWithFormulas(reportConfig, {
  columns: [{ field: 'total', formula: 'SUM(B2:B100)' }],
});
```

### ScheduleConfig

Configure recurring report generation:

```tsx
import { ScheduleConfig, createScheduleTrigger } from '@object-ui/plugin-report';

<ScheduleConfig
  reportId="monthly-sales"
  onSave={(schedule) => saveSchedule(schedule)}
/>

const trigger = createScheduleTrigger((reportId) => generateReport(reportId));
```

### Schema-Driven Usage

Components auto-register with `ComponentRegistry`:

```json
{
  "type": "report-builder",
  "report": { "sections": [] }
}
```

### Type-aware cell rendering

`ReportViewer` delegates cell rendering to the shared `getCellRenderer`
registry from `@object-ui/fields`, so each column is rendered with the
component appropriate for its type — instead of `String(value)`.

| `field.type`                  | Rendering                                     |
| ----------------------------- | --------------------------------------------- |
| `text` / `string`             | Plain text                                    |
| `number` / `currency` / `percent` | Locale-formatted, optional currency/percent symbol |
| `boolean`                     | ✓ / ✗ icons                                   |
| `date` / `datetime` / `time`  | Localised date/time                           |
| `select` / `multi_select` / `status` | Badge(s), label resolved from `options`, color from `option.color` or `colorMap` |
| `lookup` / `reference` / `master_detail` | Linked record name (id fallback), deep-link to `/console/apps/<app>/<referenceTo>/record/<id>` |
| `email`                       | `mailto:` link                                |
| `url`                         | External link (`target="_blank"`)             |
| `phone`                       | `tel:` link                                   |
| `image`                       | Inline thumbnail                              |
| `file`                        | Filename + download link                      |
| `user` / `owner`              | Avatar + name                                 |
| `richtext` / `html` / `markdown` | Sanitised inline content                   |
| `json`                        | Collapsed code preview                        |

Authors do **not** need to repeat type metadata on every report column:
when a report binds an `objectName`, the runtime auto-hydrates each
column's `type`, `options`, `referenceTo`, and `label` from the
corresponding `ObjectField`. Author-provided values always win.

Minimal report leveraging type-aware cells:

```ts
import type { ReportInput } from '@objectstack/spec/ui';

export const ContactsReport: ReportInput = {
  name: 'contacts_by_account',
  label: 'Contacts by Account',
  objectName: 'contact', // ← enables auto-hydration
  type: 'tabular',
  columns: [
    { field: 'full_name', label: 'Name' },
    { field: 'email',      label: 'Email' },     // → mailto:
    { field: 'phone',      label: 'Phone' },     // → tel:
    { field: 'is_primary', label: 'Primary' },   // → ✓/✗
    { field: 'account',    label: 'Account' },   // → linked record
    { field: 'status',     label: 'Status' },    // → Badge with option color
  ],
};
```

Override per column when needed:

```ts
columns: [
  { field: 'tier', label: 'Tier', type: 'select',
    options: [{ value: 'gold', label: 'Gold', color: 'amber' }] },
]
```

Legacy `renderAs: 'badge'` + `colorMap` is still honoured for plain
string columns.

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-report)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-report)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).

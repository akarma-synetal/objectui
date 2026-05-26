/**
 * DevMetaTestPage — TEMPORARY dev-only sandbox to manually exercise the
 * Metadata management container pages against a running framework dev
 * server. Mounted by App.tsx at `/dev/meta` and `/dev/meta/:objectName`.
 *
 * This file should be deleted once the host-app integration ships.
 */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MetadataClient } from '@object-ui/data-objectstack';
import {
  MetadataObjectsPage,
  MetadataFieldsPage,
} from '@object-ui/plugin-designer';

// Hard-coded for the local example-crm framework dev server.
const FRAMEWORK_BASE = 'http://localhost:3001';
const client = new MetadataClient({ baseUrl: FRAMEWORK_BASE });

export function DevMetaObjectsTestPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Dev · Metadata · Objects</h1>
      <p className="text-xs text-muted-foreground">
        baseUrl = {FRAMEWORK_BASE}
      </p>
      <MetadataObjectsPage
        client={client}
        hideSystemObjects={false}
        onSelectObject={(o) => {
          // navigate via plain anchor click for simplicity
          window.location.href = `/dev/meta/${o.name}`;
        }}
      />
    </div>
  );
}

export function DevMetaFieldsTestPage() {
  const { objectName } = useParams<{ objectName: string }>();
  const [name, setName] = useState(objectName ?? 'crm_account');
  return (
    <div className="p-6 space-y-4">
      <Link to="/dev/meta" className="text-xs text-blue-600 underline">
        ← back to objects
      </Link>
      <h1 className="text-lg font-bold">Dev · Metadata · Fields</h1>
      <div className="flex items-center gap-2 text-xs">
        <label>object name:</label>
        <input
          className="rounded border px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <MetadataFieldsPage
        key={name}
        client={client}
        objectName={name}
      />
    </div>
  );
}

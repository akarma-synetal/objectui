// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Object Manager list page — custom `ListPage` for the `object` metadata
 * type, registered with the metadata-admin engine via
 * `registerMetadataResource()`.
 *
 * Wraps `ObjectManager` from `@object-ui/plugin-designer` (the rich
 * visual designer) and bridges it to the MetadataService CRUD pipeline
 * (optimistic update → API call → rollback). Selecting an object navigates
 * into the engine's edit page so authors keep the Form/Layers/References
 * tabs from there.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ObjectManager } from '@object-ui/plugin-designer';
import type { ObjectDefinition } from '@object-ui/types';
import { toast } from 'sonner';
import { useMetadata, useMetadataService } from '@object-ui/app-shell';
import { MetadataService } from '../services/MetadataService';
import { toObjectDefinition } from '../utils/metadataConverters';

interface ObjectManagerListPageProps {
  /** Singular metadata type, always `'object'` here. */
  type: string;
}

/**
 * Derive the metadata-admin base path (everything up to and including
 * `…/component/metadata/resource`) from the current URL so the edit links
 * survive whichever app/sub-app the user is in.
 */
function useResourceBase(): string {
  const location = useLocation();
  const marker = '/component/metadata/resource';
  const idx = location.pathname.indexOf(marker);
  if (idx >= 0) return location.pathname.slice(0, idx + marker.length);
  // Fallback — shouldn't happen since this page is only mounted under that
  // route, but keep something sensible.
  return location.pathname;
}

export function ObjectManagerListPage({ type }: ObjectManagerListPageProps) {
  const navigate = useNavigate();
  const resourceBase = useResourceBase();
  const { objects: metadataObjects, refresh } = useMetadata();
  const metadataService = useMetadataService();

  const objects = useMemo<ObjectDefinition[]>(
    () => (metadataObjects || []).map(toObjectDefinition),
    [metadataObjects],
  );

  const [localObjects, setLocalObjects] = useState<ObjectDefinition[] | null>(null);
  const [saving, setSaving] = useState(false);
  const displayObjects = localObjects ?? objects;
  const prevObjectsRef = useRef<ObjectDefinition[]>(displayObjects);

  const handleSelectObject = useCallback(
    (obj: ObjectDefinition) => {
      navigate(`${resourceBase}/${obj.name}?type=${type}`);
    },
    [navigate, resourceBase, type],
  );

  const handleObjectsChange = useCallback(
    async (updated: ObjectDefinition[]) => {
      const previous = prevObjectsRef.current;
      setLocalObjects(updated);
      prevObjectsRef.current = updated;

      if (!metadataService) {
        toast.error('Service unavailable — changes saved locally only');
        return;
      }

      const diff = MetadataService.diffObjects(previous, updated);
      setSaving(true);
      try {
        if (diff) {
          if (diff.type === 'delete') {
            await metadataService.deleteObject(diff.object.name);
          } else {
            await metadataService.saveObject(diff.object);
          }
        } else {
          for (const obj of updated) {
            await metadataService.saveObject(obj);
          }
        }
        await refresh();
        const actionLabel = diff
          ? diff.type === 'create'
            ? `Object "${diff.object.label || diff.object.name}" created`
            : diff.type === 'update'
              ? `Object "${diff.object.label || diff.object.name}" updated`
              : `Object "${diff.object.label || diff.object.name}" deleted`
          : 'Object definitions updated';
        toast.success(actionLabel);
      } catch (err: any) {
        setLocalObjects(previous);
        prevObjectsRef.current = previous;
        toast.error(err?.message || 'Failed to save object changes');
      } finally {
        setSaving(false);
      }
    },
    [metadataService, refresh],
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {saving && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="object-saving-indicator"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving object changes…
        </div>
      )}
      <ObjectManager
        objects={displayObjects}
        onObjectsChange={handleObjectsChange}
        onSelectObject={handleSelectObject}
        showSystemObjects
      />
    </div>
  );
}

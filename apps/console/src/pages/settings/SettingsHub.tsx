/**
 * <SettingsHub> — landing page for `/system/settings`.
 *
 * Lists every visible manifest grouped by category. Cards mirror the
 * SystemHubPage look-and-feel for visual consistency.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Skeleton,
} from '@object-ui/components';
import { Settings as SettingsIcon } from 'lucide-react';
import { getIcon } from '../../utils/getIcon';
import { listSettingsManifests } from './api';
import { resolveLabel, type SettingsManifest } from './types';

export function SettingsHub() {
  const navigate = useNavigate();
  const [manifests, setManifests] = useState<SettingsManifest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSettingsManifests()
      .then((r) => setManifests(r.manifests ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load settings'));
  }, []);

  const byCategory = useMemo(() => {
    if (!manifests) return null;
    const grouped = new Map<string, SettingsManifest[]>();
    for (const m of [...manifests].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))) {
      const cat = m.category ?? 'Other';
      const arr = grouped.get(cat) ?? [];
      arr.push(m);
      grouped.set(cat, arr);
    }
    return grouped;
  }, [manifests]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your workspace, integrations, and feature flags.</p>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!manifests ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      ) : manifests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No settings registered. Plugins can register settings manifests via the SettingsService.
          </CardContent>
        </Card>
      ) : (
        Array.from(byCategory ?? []).map(([category, items]) => (
          <section key={category} className="mb-8">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-3">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((m) => {
                const Icon = m.icon ? getIcon(m.icon) : SettingsIcon;
                return (
                  <Card
                    key={m.namespace}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                    onClick={() => navigate(`/system/settings/${m.namespace}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                        {m.beta ? <Badge variant="secondary" className="text-[10px]">Beta</Badge> : null}
                      </div>
                      <CardTitle className="text-base mt-2">{resolveLabel(m.label)}</CardTitle>
                      {m.description ? (
                        <CardDescription className="text-xs">{m.description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-[11px] text-muted-foreground">
                        {m.specifiers.length} setting{m.specifiers.length === 1 ? '' : 's'}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

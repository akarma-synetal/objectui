/**
 * Marketplace Page — browse approved, marketplace-listed packages.
 *
 * Card-grid catalog of public packages, fetched from the tenant runtime's
 * `/api/v1/marketplace/packages` proxy (which forwards to the configured
 * cloud control plane). Click-through opens the package detail page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Input,
  Button,
  Skeleton,
} from '@object-ui/components';
import { Package, Search, RefreshCcw, Store, AlertCircle } from 'lucide-react';
import {
  listMarketplacePackages,
  type MarketplacePackageSummary,
} from './marketplaceApi';

function formatRelative(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = appName ? `/apps/${appName}` : '';
  const [items, setItems] = useState<MarketplacePackageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listMarketplacePackages({ limit: 100 });
      setItems(resp.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      if (it.category) s.add(it.category);
    }
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category && it.category !== category) return false;
      if (!q) return true;
      const hay = `${it.display_name} ${it.manifest_id} ${it.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, category]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">App Marketplace</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Browse approved apps published to the ObjectStack catalog. Click an app to view details and install it into one of your environments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps by name or manifest ID…"
            className="pl-9"
            aria-label="Search marketplace apps"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={category === '' ? 'default' : 'outline'}
              onClick={() => setCategory('')}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={category === cat ? 'default' : 'outline'}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" aria-hidden="true" />
          <div>
            <div className="font-medium text-destructive">Failed to load marketplace</div>
            <div className="text-muted-foreground mt-1">{error}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Check that this runtime is configured with <code className="font-mono">OS_CLOUD_URL</code> pointing at a reachable ObjectStack Cloud.
            </div>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-10 w-10 rounded-lg mb-2" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {items.length === 0 ? 'No apps have been approved for the marketplace yet.' : 'No apps match your filters.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => {
            const initial = (pkg.display_name || pkg.manifest_id || '?').slice(0, 1).toUpperCase();
            return (
              <Card
                key={pkg.id}
                className="cursor-pointer transition-colors hover:bg-accent/50 flex flex-col"
                onClick={() => navigate(`${basePath}/system/marketplace/${pkg.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`${basePath}/system/marketplace/${pkg.id}`);
                  }
                }}
                data-testid={`marketplace-card-${pkg.manifest_id}`}
              >
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary overflow-hidden">
                    {pkg.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pkg.icon_url} alt="" className="h-10 w-10 object-cover" />
                    ) : (
                      <span className="text-base font-semibold">{initial}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{pkg.display_name || pkg.manifest_id}</CardTitle>
                    <CardDescription className="text-xs truncate">
                      <code className="font-mono">{pkg.manifest_id}</code>
                    </CardDescription>
                  </div>
                  {pkg.publisher && pkg.publisher !== 'private' && (
                    <Badge variant={pkg.publisher === 'objectstack' ? 'default' : 'secondary'} className="shrink-0">
                      {pkg.publisher}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pkg.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    {pkg.latest_version?.version && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="h-3 w-3 mr-1" aria-hidden="true" />
                        v{pkg.latest_version.version}
                      </Badge>
                    )}
                    {pkg.category && (
                      <Badge variant="outline" className="text-xs">{pkg.category}</Badge>
                    )}
                    {pkg.latest_version?.published_at && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatRelative(pkg.latest_version.published_at)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

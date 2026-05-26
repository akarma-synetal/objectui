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
import { Package, Search, RefreshCcw, Store, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import { useIsWorkspaceAdmin } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { PackageIcon } from './PackageIcon';
import { MarketplaceAccessDenied } from './MarketplaceAccessDenied';
import { localizePackage } from './usePackageL10n';
import {
  listMarketplacePackages,
  listLocalInstalls,
  type MarketplacePackageSummary,
  type LocalInstallEntry,
} from './marketplaceApi';

/**
 * Format a published-at timestamp as a localized relative string.
 *
 * Uses `Intl.RelativeTimeFormat` for proper plural/grammatical rules in
 * the active locale (e.g. "il y a 3 jours", "3 天前"). Falls back to
 * translation keys for environments without RTF support.
 */
function useRelativeFormatter() {
  const { language, t } = useObjectTranslation();
  return (iso?: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days < 1) return t('marketplace.relativeTime.today');
    try {
      const rtf = new Intl.RelativeTimeFormat(language || 'en', { numeric: 'auto' });
      if (days < 30) return rtf.format(-days, 'day');
      if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
      return rtf.format(-Math.floor(days / 365), 'year');
    } catch {
      if (days < 30) return t('marketplace.relativeTime.daysAgo', { count: days });
      if (days < 365) return t('marketplace.relativeTime.monthsAgo', { count: Math.floor(days / 30) });
      return t('marketplace.relativeTime.yearsAgo', { count: Math.floor(days / 365) });
    }
  };
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const isAdmin = useIsWorkspaceAdmin();
  const { t, language } = useObjectTranslation();
  const formatRelative = useRelativeFormatter();
  const basePath = appName ? `/apps/${appName}` : '';
  const [items, setItems] = useState<MarketplacePackageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [installed, setInstalled] = useState<LocalInstallEntry[]>([]);

  const installedByManifestId = useMemo(() => {
    const m = new Map<string, LocalInstallEntry>();
    for (const e of installed) m.set(e.manifestId, e);
    return m;
  }, [installed]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resp, installs] = await Promise.all([
        listMarketplacePackages({ limit: 100 }),
        listLocalInstalls(),
      ]);
      setItems(resp.items ?? []);
      setInstalled(installs);
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

  // Translate a category enum value via the i18n bundle; fall back to the
  // raw value (lowercased) so unknown publisher categories still render.
  const categoryLabel = (cat: string): string => {
    const key = `marketplace.category.${cat}`;
    const translated = t(key, { defaultValue: cat });
    return translated === key ? cat : translated;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category && it.category !== category) return false;
      if (!q) return true;
      const loc = localizePackage(it, language);
      const hay = `${loc.displayName} ${it.manifest_id} ${loc.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, category, language]);

  if (!isAdmin) return <MarketplaceAccessDenied />;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('marketplace.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t('marketplace.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`${basePath}/system/marketplace/installed`)}
          >
            <Settings className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {installed.length > 0
              ? t('marketplace.installedCount', { count: installed.length })
              : t('marketplace.installed')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {t('marketplace.refresh')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            className="pl-9"
            aria-label={t('marketplace.searchAria')}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={category === '' ? 'default' : 'outline'}
              onClick={() => setCategory('')}
            >
              {t('marketplace.all')}
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={category === cat ? 'default' : 'outline'}
                onClick={() => setCategory(cat)}
              >
                {categoryLabel(cat)}
              </Button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" aria-hidden="true" />
          <div>
            <div className="font-medium text-destructive">{t('marketplace.load.failed')}</div>
            <div className="text-muted-foreground mt-1">{error}</div>
            <div
              className="text-xs text-muted-foreground mt-2"
              // Hint message contains an inline <code> tag — render translated HTML safely from our own bundle.
              dangerouslySetInnerHTML={{ __html: t('marketplace.load.failedHint') }}
            />
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
          {items.length === 0 ? t('marketplace.noApprovedYet') : t('marketplace.noMatchFilters')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => {
            const localEntry = installedByManifestId.get(pkg.manifest_id);
            const loc = localizePackage(pkg, language);
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
                  <PackageIcon
                    iconUrl={pkg.icon_url}
                    displayName={loc.displayName}
                    manifestId={pkg.manifest_id}
                  />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{loc.displayName}</CardTitle>
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
                    {loc.description || t('marketplace.noDescription')}
                  </p>
                  <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
                    {localEntry && (
                      <Badge
                        variant="default"
                        className="text-xs bg-green-600 hover:bg-green-600"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                        {t('marketplace.installedBadge', { version: localEntry.version })}
                      </Badge>
                    )}
                    {pkg.latest_version?.version && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="h-3 w-3 mr-1" aria-hidden="true" />
                        {t('marketplace.versionBadge', { version: pkg.latest_version.version })}
                      </Badge>
                    )}
                    {pkg.category && (
                      <Badge variant="outline" className="text-xs">{categoryLabel(pkg.category)}</Badge>
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

/**
 * Marketplace Package Detail Page.
 *
 * Shows full package metadata + readme + approved version list. Provides
 * an "Install" button that opens a dialog with environment picker.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@object-ui/components';
import { ArrowLeft, ExternalLink, Download, AlertCircle, Package, Trash2, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { useIsWorkspaceAdmin } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { PackageIcon } from './PackageIcon';
import { MarkdownText } from './MarkdownText';
import { MarketplaceAccessDenied } from './MarketplaceAccessDenied';
import { localizePackage } from './usePackageL10n';
import {
  getMarketplacePackage,
  installPackage,
  installLocal,
  uninstallLocal,
  listLocalInstalls,
  listCloudEnvironments,
  listInstallableOrgIds,
  cloudInstallDeepLink,
  type MarketplaceDetailResponse,
  type CloudEnvironment,
  type LocalInstallEntry,
} from './marketplaceApi';
import { getRuntimeConfig } from '../../runtime-config';
import { useMetadata } from '../../providers/MetadataProvider';

export function MarketplacePackagePage() {
  const navigate = useNavigate();
  const { packageId, appName } = useParams<{ packageId?: string; appName?: string }>();
  const isAdmin = useIsWorkspaceAdmin();
  const { t, language } = useObjectTranslation();
  const basePath = appName ? `/apps/${appName}` : '';
  const { refresh: refreshMetadata } = useMetadata();

  const [data, setData] = useState<MarketplaceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [installOpen, setInstallOpen] = useState(false);
  const [envs, setEnvs] = useState<CloudEnvironment[]>([]);
  const [envsLoading, setEnvsLoading] = useState(false);
  const [envsError, setEnvsError] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string>('');
  const [seedSampleData, setSeedSampleData] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Local-install state (this runtime's own kernel — separate flow from cloud).
  const [localInstalls, setLocalInstalls] = useState<LocalInstallEntry[]>([]);
  const [installingLocal, setInstallingLocal] = useState(false);
  const [localResult, setLocalResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!getRuntimeConfig().features.installLocal) return;
    let cancelled = false;
    (async () => {
      const items = await listLocalInstalls();
      if (!cancelled) setLocalInstalls(items);
    })();
    return () => { cancelled = true; };
  }, [packageId, localResult]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!packageId) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await getMarketplacePackage(packageId);
        if (!cancelled) setData(resp);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [packageId]);

  const openInstall = async () => {
    setInstallOpen(true);
    setInstallResult(null);
    setEnvsError(null);

    // When the runtime tells us which env we're on (tenant subdomain
    // like demo.objectos.app), skip the picker entirely — the operator's
    // domain already identifies the target. Just open the dialog with
    // the env pre-selected so the sample-data checkbox + Install button
    // remain in place.
    const currentEnvId = getRuntimeConfig().defaultEnvironmentId;
    if (currentEnvId) {
      setEnvsLoading(false);
      setSelectedEnv(currentEnvId);
      setEnvs([]);
      return;
    }

    setEnvsLoading(true);
    try {
      const [list, adminOrgIds] = await Promise.all([
        listCloudEnvironments(),
        listInstallableOrgIds(),
      ]);
      // Only envs in orgs where the caller is owner/admin are installable.
      // Backend enforces the same gate; mirroring it here avoids confusing
      // 403s and lets us show a helpful empty-state message.
      const installable = list.filter((env) => {
        const orgId = env.organization_id;
        return orgId ? adminOrgIds.has(String(orgId)) : false;
      });
      setEnvs(installable);
      if (list.length > 0 && installable.length === 0) {
        setEnvsError(t('marketplace.install.noPermission'));
      } else if (installable.length === 1) {
        setSelectedEnv(installable[0].id);
      }
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || status === 403) {
        setEnvsError(t('marketplace.install.signInFirst'));
      } else {
        setEnvsError(e?.message ?? String(e));
      }
    } finally {
      setEnvsLoading(false);
    }
  };

  const doInstall = async () => {
    if (!packageId || !selectedEnv) return;
    setInstalling(true);
    setInstallResult(null);
    try {
      await installPackage({ packageId, environmentId: selectedEnv, seedSampleData });
      // Invalidate the metadata cache so the newly-installed app's
      // objects/views/menus are fetched fresh on next access. Without
      // this the user sees the new app in the switcher (the `app` list
      // gets refreshed) but clicking a menu entry fails with "metadata
      // not found" because objects/views/etc. are still cached from
      // before the install. Only useful when installing into the env
      // currently rendered by this SPA — for cross-env installs the
      // refresh is a harmless no-op (re-fetches the current env's
      // metadata, which is unchanged).
      const currentEnvId = getRuntimeConfig().defaultEnvironmentId;
      if (!currentEnvId || currentEnvId === selectedEnv) {
        try {
          // Drop the persisted `app` cache too — refresh() overwrites it
          // when the new app list comes back, but clearing first protects
          // against partial failures leaving stale data on next reload.
          if (typeof sessionStorage !== 'undefined') {
            for (const key of Object.keys(sessionStorage)) {
              if (key.startsWith('objectui:metadata:')) {
                sessionStorage.removeItem(key);
              }
            }
          }
          await refreshMetadata();
        } catch {
          // Non-fatal: install succeeded; worst case the user navigates
          // away and back to pick up the new metadata.
        }
      }
      setInstallResult({ ok: true, message: t('marketplace.install.success') });
    } catch (e: any) {
      setInstallResult({ ok: false, message: e?.message ?? String(e) });
    } finally {
      setInstalling(false);
    }
  };

  /**
   * Install this package into the LOCAL runtime kernel (not a cloud env).
   * Single-target operation — no picker, no dialog. Same-origin POST so
   * cloud session is not required. The local AuthPlugin session is what
   * the backend validates.
   */
  const doInstallLocal = async () => {
    if (!packageId) return;
    setInstallingLocal(true);
    setLocalResult(null);
    try {
      const result = await installLocal({ packageId });
      try {
        await refreshMetadata('app');
      } catch {
        // Non-fatal: the install succeeded; the app list will refresh on next navigation.
      }
      setLocalResult({
        ok: true,
        message: t('marketplace.install.localSuccess', {
          version: result.version,
          name: data?.package ? localizePackage(data.package as any, language).displayName : result.manifestId,
        }),
      });
    } catch (e: any) {
      const code = e?.code;
      let msg = e?.message ?? String(e);
      if (code === 'manifest_conflict') {
        msg = t('marketplace.install.localManifestConflict', { message: msg });
      } else if (code === 'unauthorized') {
        msg = t('marketplace.install.localUnauthorized');
      } else if (code === 'marketplace_unavailable') {
        msg = t('marketplace.install.localMarketplaceUnavailable');
      }
      setLocalResult({ ok: false, message: msg });
    } finally {
      setInstallingLocal(false);
    }
  };

  /**
   * Uninstall this package's cached manifest from the local runtime.
   * NB: kernel API is additive only — the app remains live in the
   * running kernel until the runtime restarts. We surface that
   * caveat in the success message.
   */
  const doUninstallLocal = async () => {
    if (!localInstall) return;
    if (!confirm(t('marketplace.uninstall.confirm', { manifestId: localInstall.manifestId, version: localInstall.version }))) {
      return;
    }
    setInstallingLocal(true);
    setLocalResult(null);
    try {
      await uninstallLocal(localInstall.manifestId);
      try {
        await refreshMetadata('app');
      } catch {
        // Non-fatal.
      }
      setLocalResult({
        ok: true,
        message: t('marketplace.uninstall.successInDetail', { manifestId: localInstall.manifestId }),
      });
    } catch (e: any) {
      setLocalResult({ ok: false, message: e?.message ?? String(e) });
    } finally {
      setInstallingLocal(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-6 p-4 sm:p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`${basePath}/system/marketplace`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden="true" />
          {t('marketplace.back')}
        </Button>
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" aria-hidden="true" />
          <div>
            <div className="font-medium text-destructive">{t('marketplace.load.packageFailed')}</div>
            <div className="text-muted-foreground mt-1">{error ?? t('marketplace.load.notFound')}</div>
          </div>
        </div>
      </div>
    );
  }

  const pkg = data.package;
  const loc = localizePackage(pkg as any, language);
  const latestVersion = pkg.latest_version?.version ?? data.versions[0]?.version ?? null;
  const localInstall = localInstalls.find((i) => i.manifestId === pkg.manifest_id) ?? null;

  const supportsLocal = getRuntimeConfig().features.installLocal;
  const primaryDisabled = !latestVersion || installingLocal || installing;
  const primaryAction = supportsLocal
    ? {
      label: installingLocal
        ? t('marketplace.action.working')
        : localInstall
          ? t('marketplace.action.reinstall')
          : t('marketplace.action.install'),
      onClick: doInstallLocal,
    }
    : {
      label: installing ? t('marketplace.action.installing') : t('marketplace.action.installToCloud'),
      onClick: openInstall,
    };

  const categoryLabel = pkg.category
    ? t(`marketplace.category.${pkg.category}` as any, { defaultValue: pkg.category })
    : null;

  if (!isAdmin) return <MarketplaceAccessDenied />;

  return (
    <div className="mx-auto w-full max-w-6xl flex flex-col gap-6 p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="self-start -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate(`${basePath}/system/marketplace`)}>
        <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden="true" />
        {t('marketplace.back')}
      </Button>

      <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6 sm:p-8">
        <PackageIcon
          iconUrl={pkg.icon_url}
          displayName={loc.displayName}
          manifestId={pkg.manifest_id}
          className="h-20 w-20 rounded-2xl shadow-sm ring-1 ring-border shrink-0"
          initialClassName="text-3xl font-bold"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{loc.displayName || pkg.manifest_id}</h1>
            {pkg.homepage_url && (
              <a
                href={pkg.homepage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title={t('marketplace.detail.homepage')}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('marketplace.detail.homepage')}</span>
              </a>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5">
            <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{pkg.manifest_id}</code>
            {latestVersion && <Badge variant="outline">{t('marketplace.versionBadge', { version: latestVersion })}</Badge>}
            {pkg.publisher && pkg.publisher !== 'private' && (
              <Badge variant={pkg.publisher === 'objectstack' ? 'default' : 'secondary'}>{pkg.publisher}</Badge>
            )}
            {categoryLabel && <Badge variant="outline">{categoryLabel}</Badge>}
            {pkg.license && <Badge variant="outline" className="font-normal">{pkg.license}</Badge>}
            {localInstall && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {t('marketplace.detail.installedV', { version: localInstall.version })}
              </Badge>
            )}
          </div>
          {loc.description && (
            <p className="text-sm sm:text-base text-foreground/80 mt-3 max-w-2xl leading-relaxed">{loc.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start">
          <Button onClick={primaryAction.onClick} disabled={primaryDisabled} size="lg" className="min-w-[8rem]">
            <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {primaryAction.label}
          </Button>
          {localInstall && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="px-2.5" aria-label={t('marketplace.detail.moreOptions')}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={doUninstallLocal} disabled={installingLocal} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('marketplace.detail.uninstallFromRuntime')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {localResult && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-md border p-3 text-sm whitespace-pre-wrap ${localResult.ok ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}
        >
          {localResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />}
          <div className="flex-1">{localResult.message}</div>
          <button
            type="button"
            className="text-xs underline opacity-60 hover:opacity-100"
            onClick={() => setLocalResult(null)}
          >
            {t('marketplace.action.dismiss')}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('marketplace.detail.about')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loc.readme ? (
                <MarkdownText source={loc.readme} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('marketplace.detail.noReadme')}</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('marketplace.detail.versions')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('marketplace.detail.noApprovedVersions')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <code className="font-mono">v{v.version}</code>
                        {v.is_prerelease && <Badge variant="outline" className="text-xs">{t('marketplace.detail.prerelease')}</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {v.published_at ? new Date(v.published_at).toLocaleDateString() : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={installOpen} onOpenChange={(o) => { setInstallOpen(o); if (!o) setInstallResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('marketplace.install.dialogTitle', { name: loc.displayName || pkg.manifest_id })}</DialogTitle>
            <DialogDescription>
              {getRuntimeConfig().defaultEnvironmentId
                ? t('marketplace.install.dialogDescCurrent', { host: typeof window !== 'undefined' ? window.location.host : '' })
                : t('marketplace.install.dialogDescPicker')}
            </DialogDescription>
          </DialogHeader>

          {envsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : envsError ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600" aria-hidden="true" />
                <div className="flex-1">{envsError}</div>
              </div>
              <a href={cloudInstallDeepLink(pkg.id)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {t('marketplace.action.openOnCloud')}
                </Button>
              </a>
            </div>
          ) : getRuntimeConfig().defaultEnvironmentId ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="seed"
                checked={seedSampleData}
                onCheckedChange={(c) => setSeedSampleData(c === true)}
              />
              <Label htmlFor="seed" className="text-sm font-normal cursor-pointer">
                {t('marketplace.install.includeSampleData')}
              </Label>
            </div>
          ) : envs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('marketplace.install.noEnvs')}</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="env-select">{t('marketplace.install.environment')}</Label>
                <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                  <SelectTrigger id="env-select">
                    <SelectValue placeholder={t('marketplace.install.environmentPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {envs.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.display_name || e.hostname || e.id}
                        {e.plan && <span className="text-muted-foreground"> · {e.plan}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="seed"
                  checked={seedSampleData}
                  onCheckedChange={(c) => setSeedSampleData(c === true)}
                />
                <Label htmlFor="seed" className="text-sm font-normal cursor-pointer">
                  {t('marketplace.install.includeSampleData')}
                </Label>
              </div>
            </div>
          )}

          {installResult && (
            <div className={`rounded-md border p-3 text-sm ${installResult.ok ? 'border-green-500/30 bg-green-500/5 text-green-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
              {installResult.message}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>{t('marketplace.action.close')}</Button>
            {!envsError && (
              <Button
                onClick={doInstall}
                disabled={!selectedEnv || installing || installResult?.ok === true}
              >
                {installing ? t('marketplace.action.installing') : t('marketplace.action.install')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

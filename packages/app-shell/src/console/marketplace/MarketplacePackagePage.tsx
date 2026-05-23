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
} from '@object-ui/components';
import { ArrowLeft, ExternalLink, Download, AlertCircle, Package, Trash2 } from 'lucide-react';
import { PackageIcon } from './PackageIcon';
import { MarkdownText } from './MarkdownText';
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

export function MarketplacePackagePage() {
  const navigate = useNavigate();
  const { packageId, appName } = useParams<{ packageId?: string; appName?: string }>();
  const basePath = appName ? `/apps/${appName}` : '';

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
        setEnvsError(
          'You do not have permission to install apps in any environment. ' +
          'Only organization owners and admins can install — ask your workspace admin.',
        );
      } else if (installable.length === 1) {
        setSelectedEnv(installable[0].id);
      }
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || status === 403) {
        setEnvsError('You need to sign into ObjectStack Cloud first. Click "Open on cloud" below.');
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
      setInstallResult({ ok: true, message: 'Installed successfully. Open the environment to see the new app.' });
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
      setLocalResult({
        ok: true,
        message: `Installed v${result.version} to this runtime. Refresh the console to see "${data?.package?.display_name ?? result.manifestId}" in the app switcher.`,
      });
    } catch (e: any) {
      const code = e?.code;
      let msg = e?.message ?? String(e);
      if (code === 'manifest_conflict') {
        msg = `${msg}\nTip: a local app already owns this manifest_id. Remove it from objectstack.config.ts first.`;
      } else if (code === 'unauthorized') {
        msg = 'Sign in to this runtime first, then try again.';
      } else if (code === 'marketplace_unavailable') {
        msg = 'This runtime has no OS_CLOUD_URL configured, so the marketplace catalog is unreachable.';
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
    if (!confirm(`Uninstall ${localInstall.manifestId} v${localInstall.version} from this runtime?\n\nThe cached manifest will be removed. The app will remain loaded in the running kernel until the next restart.`)) {
      return;
    }
    setInstallingLocal(true);
    setLocalResult(null);
    try {
      await uninstallLocal(localInstall.manifestId);
      setLocalResult({
        ok: true,
        message: `Removed cached manifest for ${localInstall.manifestId}. Restart the runtime to fully unload the app from the running kernel.`,
      });
    } catch (e: any) {
      setLocalResult({ ok: false, message: e?.message ?? String(e) });
    } finally {
      setInstallingLocal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`${basePath}/system/marketplace`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Back to marketplace
        </Button>
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" aria-hidden="true" />
          <div>
            <div className="font-medium text-destructive">Failed to load package</div>
            <div className="text-muted-foreground mt-1">{error ?? 'Not found.'}</div>
          </div>
        </div>
      </div>
    );
  }

  const pkg = data.package;
  const latestVersion = pkg.latest_version?.version ?? data.versions[0]?.version ?? null;
  const localInstall = localInstalls.find((i) => i.manifestId === pkg.manifest_id) ?? null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl">
      <Button variant="ghost" size="sm" className="self-start" onClick={() => navigate(`${basePath}/system/marketplace`)}>
        <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden="true" />
        Back to marketplace
      </Button>

      <div className="flex items-start gap-5 flex-wrap rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <PackageIcon
          iconUrl={pkg.icon_url}
          displayName={pkg.display_name}
          manifestId={pkg.manifest_id}
          className="h-20 w-20 rounded-2xl shadow-sm ring-1 ring-border"
          initialClassName="text-3xl font-bold"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight truncate">{pkg.display_name || pkg.manifest_id}</h1>
          <div className="text-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{pkg.manifest_id}</code>
            {latestVersion && (
              <Badge variant="outline">v{latestVersion}</Badge>
            )}
            {pkg.publisher && pkg.publisher !== 'private' && (
              <Badge variant={pkg.publisher === 'objectstack' ? 'default' : 'secondary'}>{pkg.publisher}</Badge>
            )}
            {pkg.category && <Badge variant="outline">{pkg.category}</Badge>}
            {pkg.license && <Badge variant="outline" className="font-normal">{pkg.license}</Badge>}
            {localInstall && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                Installed · v{localInstall.version}
              </Badge>
            )}
          </div>
          {pkg.description && (
            <p className="text-base text-foreground/80 mt-4 max-w-2xl leading-relaxed">{pkg.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 min-w-[14rem]">
          <Button onClick={doInstallLocal} disabled={!latestVersion || installingLocal} size="lg">
            <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {installingLocal
              ? 'Working…'
              : localInstall
                ? `Reinstall to this runtime`
                : 'Install to this runtime'}
          </Button>
          {localInstall && (
            <Button variant="outline" onClick={doUninstallLocal} disabled={installingLocal}>
              <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Uninstall from this runtime
            </Button>
          )}
          <Button variant="ghost" onClick={openInstall} disabled={!latestVersion} size="sm">
            <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Install to cloud environment…
          </Button>
          {pkg.homepage_url && (
            <a href={pkg.homepage_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="w-full">
                <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Homepage
              </Button>
            </a>
          )}
          {localResult && (
            <div className={`rounded-md border p-2 text-xs whitespace-pre-wrap ${localResult.ok ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
              {localResult.message}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent>
              {pkg.readme ? (
                <MarkdownText source={pkg.readme} />
              ) : (
                <p className="text-sm text-muted-foreground">No readme provided.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Versions</CardTitle>
            </CardHeader>
            <CardContent>
              {data.versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved versions.</p>
              ) : (
                <ul className="space-y-2">
                  {data.versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <code className="font-mono">v{v.version}</code>
                        {v.is_prerelease && <Badge variant="outline" className="text-xs">pre</Badge>}
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
            <DialogTitle>Install {pkg.display_name || pkg.manifest_id}</DialogTitle>
            <DialogDescription>
              Choose an environment to install this app into. You need to be signed into ObjectStack Cloud.
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
                  Open on cloud
                </Button>
              </a>
            </div>
          ) : envs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No environments found in your active organization.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="env-select">Environment</Label>
                <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                  <SelectTrigger id="env-select">
                    <SelectValue placeholder="Pick an environment" />
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
                  Include sample data
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
            <Button variant="outline" onClick={() => setInstallOpen(false)}>Close</Button>
            {!envsError && (
              <Button
                onClick={doInstall}
                disabled={!selectedEnv || installing || installResult?.ok === true}
              >
                {installing ? 'Installing…' : 'Install'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

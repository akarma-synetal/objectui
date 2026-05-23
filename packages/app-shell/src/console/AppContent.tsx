/**
 * AppContent — inner SPA rendered under /apps/:appName/*.
 *
 * Owns the per-app shell: ConsoleLayout, CommandPalette, KeyboardShortcutsDialog,
 * route table for object/dashboard/report/page views, and the global ModalForm
 * used by ObjectView edit actions. The outer routing skeleton (BrowserRouter,
 * AuthGuard, AdapterProvider, MetadataProvider, theme/toaster, /home, /login,
 * /organizations) is provided by `createConsole` from @object-ui/app-shell.
 */

import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useState, useEffect, useCallback, lazy, Suspense, useMemo, type ReactNode } from 'react';
import { ModalForm } from '@object-ui/plugin-form';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { toast } from 'sonner';
import { useActionRunner, useGlobalUndo } from '@object-ui/react';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import type { ConnectionState } from '@object-ui/data-objectstack';
import { useAuth } from '@object-ui/auth';
import { useMetadata } from '../providers/MetadataProvider';
import { useAdapter } from '../providers/AdapterProvider';
import { ExpressionProvider, evaluateVisibility } from '../providers/ExpressionProvider';
import { useTrackRouteAsRecent } from '../hooks/useTrackRouteAsRecent';
import { resolveRecordFormTarget, resolveNavigateCreateUrl, resolveNavigateEditUrl } from '../utils/recordFormNavigation';
import { ExpressionEvaluator } from '@object-ui/core';

// Components (eagerly loaded — always needed)
import { ConsoleLayout } from '../layout/ConsoleLayout';
import { CommandPalette } from '../chrome/CommandPalette';
import { ErrorBoundary } from '../chrome/ErrorBoundary';
import { LoadingScreen } from '../chrome/LoadingScreen';
import { ObjectView } from '../views/ObjectView';
import { KeyboardShortcutsDialog } from '../chrome/KeyboardShortcutsDialog';
import { OnboardingWalkthrough } from '../chrome/OnboardingWalkthrough';
import { NavigationSyncEffect } from '../hooks/useNavigationSync';

// Route-based code splitting — lazy-load less-frequently-used routes
const RecordDetailView = lazy(() => import('../views/RecordDetailView').then(m => ({ default: m.RecordDetailView })));
const DashboardView = lazy(() => import('../views/DashboardView').then(m => ({ default: m.DashboardView })));
const PageView = lazy(() => import('../views/PageView').then(m => ({ default: m.PageView })));
const ReportView = lazy(() => import('../views/ReportView').then(m => ({ default: m.ReportView })));
const SearchResultsPage = lazy(() => import('../views/SearchResultsPage').then(m => ({ default: m.SearchResultsPage })));
const RecordFormPage = lazy(() => import('../views/RecordFormPage').then(m => ({ default: m.RecordFormPage })));

// Designer pages — sourced from @object-ui/plugin-designer so third-party hosts
// can opt out by not registering these routes.
const CreateAppPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.CreateAppPage })));
const EditAppPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.EditAppPage })));
const PageDesignPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.PageDesignPage })));
const DashboardDesignPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.DashboardDesignPage })));

interface AppContentProps {
  /**
   * Extra <Route> elements appended to the inner /apps/:appName/* router.
   * Hosts can use this to mount console-specific routes (e.g. /system, legacy
   * metadata editor) without forking AppContent.
   */
  extraRoutes?: ReactNode;
  /**
   * Extra <Route> elements rendered when there is no active app but the URL
   * matches a special path (create-app, system). Mirrors `extraRoutes` for
   * the no-app branch.
   */
  extraRoutesNoApp?: ReactNode;
}

export function AppContent({ extraRoutes, extraRoutesNoApp }: AppContentProps = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const { user } = useAuth();
  const dataSource = useAdapter();

  const navigate = useNavigate();
  const location = useLocation();
  const { appName } = useParams();
  const { apps, objects: allObjects, loading: metadataLoading, ensureType } = useMetadata();
  const { t } = useObjectTranslation();
  const { objectLabel } = useObjectLabel();

  // Preload the metadata buckets that the routes under /apps/:appName/* assume
  // are fully loaded by render time (the lazy MetadataProvider only eagerly
  // loads `app`).
  const [scopeMetaReady, setScopeMetaReady] = useState(!ensureType);
  useEffect(() => {
    if (!ensureType) {
      setScopeMetaReady(true);
      return;
    }
    let cancelled = false;
    Promise.all([
      ensureType('object'),
      ensureType('dashboard'),
      ensureType('report'),
      ensureType('page'),
    ]).finally(() => {
      if (!cancelled) setScopeMetaReady(true);
    });
    return () => { cancelled = true; };
  }, [ensureType]);

  const activeApps = apps.filter((a: any) => a.active !== false);
  const activeApp =
    apps.find((a: any) => a.name === appName) ||
    activeApps.find((a: any) => a.isDefault === true) ||
    activeApps[0];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { execute: executeAction, runner } = useActionRunner();

  useGlobalUndo({
    dataSource: dataSource ?? undefined,
    onUndo: (op: any) => {
      toast.info(`Undo: ${op.description}`, { duration: 4000 });
      setRefreshKey(k => k + 1);
    },
    onRedo: (op: any) => {
      toast.info(`Redo: ${op.description}`, { duration: 3000 });
      setRefreshKey(k => k + 1);
    },
  });

  useEffect(() => {
    runner.registerHandler('crud_success', async (action: any) => {
      setIsDialogOpen(false);
      setRefreshKey(k => k + 1);
      toast.success(action.params?.message ?? 'Record saved successfully');
      return { success: true, reload: true };
    });

    runner.registerHandler('dialog_cancel', async () => {
      setIsDialogOpen(false);
      return { success: true };
    });

    // Page-mode navigation handlers — declarative counterparts to the
    // imperative `handleEdit` callback. These let JSON schemas open the
    // full-screen create/edit pages directly via `<action:button>` without
    // any custom code:
    //   { "action": "navigate_create", "params": { "objectName": "..." } }
    //   { "action": "navigate_edit",
    //     "params": { "objectName": "...", "recordId": "..." } }
    // The `objectName` param falls back to the action context's
    // `objectName` (set per view) so action buttons mounted inside an
    // ObjectView can omit it.
    // NOTE on duplication below: each handler reads `runner.getContext()`
    // INSIDE its closure (at action-invocation time) rather than once at
    // registration. Hoisting the call outside the registrations would
    // freeze the context to whatever it was when the effect last ran,
    // breaking dynamic per-view `runner.updateContext({ objectName, ... })`
    // calls (used by ObjectView / RecordDetailView). Keep the call where
    // it is.
    runner.registerHandler('navigate_create', async (action: any) => {
      const ctx = runner.getContext?.() ?? {};
      const result = resolveNavigateCreateUrl({
        action,
        context: ctx,
        defaultBaseUrl: `/apps/${appName ?? ''}`,
      });
      if (!result.success) return result;
      navigate(result.url);
      return { success: true };
    });

    runner.registerHandler('navigate_edit', async (action: any) => {
      const ctx = runner.getContext?.() ?? {};
      const result = resolveNavigateEditUrl({
        action,
        context: ctx,
        defaultBaseUrl: `/apps/${appName ?? ''}`,
      });
      if (!result.success) return result;
      navigate(result.url);
      return { success: true };
    });

    // NOTE: `flow` actions are handled at the per-view ActionProvider level
    // (RecordDetailView / ObjectView) so they share the same ActionRunner that
    // <action:button> renderers consume via useAction(). Do NOT register a
    // `flow` handler on this top-level useActionRunner — it lives on a
    // different ActionRunner instance and would never be invoked from the
    // record/list action buttons.
  }, [runner, navigate, appName]);

  useEffect(() => {
    if (!dataSource) return;
    const unsub = dataSource.onConnectionStateChange((event: any) => {
      setConnectionState(event.state);
      if (event.error) console.error('[Console] Connection error:', event.error);
    });
    setConnectionState(dataSource.getConnectionState());
    return unsub;
  }, [dataSource]);

  const cleanParts = location.pathname.split('/').filter(Boolean);
  let objectNameFromPath = cleanParts[2];
  if (
    objectNameFromPath === 'view' ||
    objectNameFromPath === 'record' ||
    objectNameFromPath === 'page' ||
    objectNameFromPath === 'dashboard' ||
    objectNameFromPath === 'design'
  ) {
    objectNameFromPath = '';
  }

  const currentObjectDef = allObjects.find((o: any) => o.name === objectNameFromPath);

  const handleCrudSuccess = useCallback(() => {
    const label = currentObjectDef ? objectLabel(currentObjectDef as any) : t('common.record', { defaultValue: 'Record' });
    executeAction({
      type: 'crud_success',
      params: {
        message: editingRecord
          ? t('form.updateSuccess', { object: label, defaultValue: `${label} updated successfully` })
          : t('form.createSuccess', { object: label, defaultValue: `${label} created successfully` }),
      },
    });
  }, [executeAction, editingRecord, currentObjectDef, objectLabel, t]);

  const handleDialogCancel = useCallback(() => {
    executeAction({ type: 'dialog_cancel' });
  }, [executeAction]);

  // Track recent items on route change.
  useTrackRouteAsRecent({
    pathname: location.pathname,
    appName: activeApp?.name,
    objects: allObjects,
  });

  const handleEdit = (record: any) => {
    // Page-mode opt-in: when the object metadata declares
    // `editMode: 'page'`, route to the full-screen create/edit page instead
    // of opening the global ModalForm. Default behavior (modal) is
    // preserved for any object without the flag.
    const target = resolveRecordFormTarget({
      objectDef: currentObjectDef as any,
      baseUrl: activeApp?.name ? `/apps/${activeApp.name}` : '',
      record,
    });
    if (target.kind === 'page') {
      navigate(target.url);
      return;
    }
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  const handleAppChange = (newAppName: string) => {
    navigate(`/apps/${newAppName}`);
  };

  const expressionEvaluator = useMemo(
    () => new ExpressionEvaluator({
      user: user ? { name: user.name, email: user.email, role: user.role ?? 'user' } : {},
      app: activeApp || {},
      data: editingRecord || {},
    }),
    [user, activeApp, editingRecord],
  );

  if (!dataSource || metadataLoading || !scopeMetaReady) return <LoadingScreen />;

  const isCreateAppRoute = location.pathname.endsWith('/create-app');
  const isSystemRoute = location.pathname.includes('/system');

  if (!activeApp && !isCreateAppRoute && !isSystemRoute) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>{t('empty.noAppsConfigured')}</EmptyTitle>
        <EmptyDescription>
          {t('empty.noAppsConfiguredDescription')}
        </EmptyDescription>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <Button onClick={() => navigate('/create-app')} data-testid="create-first-app-btn">
            {t('empty.createFirstApp')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/apps/setup')} data-testid="go-to-settings-btn">
            {t('empty.systemSettings')}
          </Button>
        </div>
      </Empty>
    </div>
  );

  if (!activeApp && (isCreateAppRoute || isSystemRoute)) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="create-app" element={<CreateAppPage />} />
          {extraRoutesNoApp}
        </Routes>
      </Suspense>
    );
  }

  const expressionUser = user
    ? { name: user.name, email: user.email, role: user.role ?? 'user' }
    : { name: 'Anonymous', email: '', role: 'guest' };

  return (
    <ExpressionProvider user={expressionUser} app={activeApp} data={{}}>
      <NavigationSyncEffect />
      <ConsoleLayout
        activeAppName={activeApp.name}
        activeApp={activeApp}
        onAppChange={handleAppChange}
        objects={allObjects}
        connectionState={connectionState}
      >
        <CommandPalette
          apps={apps}
          activeApp={activeApp}
          objects={allObjects}
          onAppChange={handleAppChange}
        />
        <KeyboardShortcutsDialog />
        <OnboardingWalkthrough />
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Navigate to={resolveLandingRoute(activeApp)} replace />} />
                <Route path=":objectName" element={
                  <ObjectView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} externalRefreshKey={refreshKey} />
                } />
                <Route path=":objectName/new" element={
                  <RecordFormPage mode="create" />
                } />
                <Route path=":objectName/view/:viewId" element={
                  <ObjectView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} externalRefreshKey={refreshKey} />
                } />
                <Route path=":objectName/record/:recordId" element={
                  <RecordDetailView key={refreshKey} dataSource={dataSource} objects={allObjects} onEdit={handleEdit} />
                } />
                <Route path=":objectName/record/:recordId/edit" element={
                  <RecordFormPage mode="edit" />
                } />
                <Route path="dashboard/:dashboardName" element={<DashboardView dataSource={dataSource} />} />
                <Route path="report/:reportName" element={<ReportView dataSource={dataSource} />} />
                <Route path="page/:pageName" element={<PageView />} />
                <Route path="design/page/:pageName" element={<PageDesignPage />} />
                <Route path="design/dashboard/:dashboardName" element={<DashboardDesignPage />} />
                <Route path="search" element={<SearchResultsPage />} />
                <Route path="create-app" element={<CreateAppPage />} />
                <Route path="edit-app/:editAppName" element={<EditAppPage />} />
                {extraRoutes}
                {/* Shorthand-deep-link redirect: a bare `/{:objectName}/:maybeRecordId`
                    URL is ambiguous — it could be a view id or a record id. When
                    the second segment matches a record-id shape (URL-safe, ≥6
                    chars, not a reserved word like `new` / `view` / `record`)
                    we forward it to the canonical record route. This catches:
                    - middle/Cmd-click links that legacy producers built before
                      the URL builder was fixed
                    - externally shared / pasted links (email, Slack)
                    - copy-paste of a record id appended to an object URL */}
                <Route path=":objectName/:maybeRecordId" element={<ShorthandRecordRedirect />} />
                {/* Catch-all: render an explicit "not found" instead of a blank
                    page so users always know when a URL didn't resolve. */}
                <Route path="*" element={<RouteNotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          {currentObjectDef && (
            <ModalForm
              key={editingRecord?.id || 'new'}
              schema={{
                type: 'object-form',
                formType: 'modal',
                objectName: currentObjectDef.name,
                mode: editingRecord ? 'edit' : 'create',
                recordId: editingRecord?.id,
                title: editingRecord
                  ? t('form.editTitle', { object: objectLabel(currentObjectDef as any) })
                  : t('form.createTitle', { object: objectLabel(currentObjectDef as any) }),
                description: editingRecord
                  ? t('form.editDescription', { object: objectLabel(currentObjectDef as any) })
                  : t('form.createDescription', { object: objectLabel(currentObjectDef as any) }),
                open: isDialogOpen,
                onOpenChange: setIsDialogOpen,
                layout: 'vertical',
                fields: currentObjectDef.fields
                  ? (Array.isArray(currentObjectDef.fields)
                      ? currentObjectDef.fields
                          .filter((f: any) => {
                            if (typeof f === 'string') return true;
                            return evaluateVisibility(f.visible, expressionEvaluator);
                          })
                          .map((f: any) => typeof f === 'string' ? f : f.name)
                      : Object.entries(currentObjectDef.fields)
                          .filter(([_, f]: [string, any]) => evaluateVisibility(f.visible, expressionEvaluator))
                          .map(([key]: [string, any]) => key))
                  : [],
                onSuccess: handleCrudSuccess,
                onCancel: handleDialogCancel,
                showSubmit: true,
                showCancel: true,
                submitText: editingRecord
                  ? t('form.update', { defaultValue: t('common.save', { defaultValue: 'Save' }) })
                  : t('form.create', { defaultValue: t('common.create', { defaultValue: 'Create' }) }),
                cancelText: t('common.cancel'),
              }}
              dataSource={dataSource}
            />
          )}
      </ConsoleLayout>
    </ExpressionProvider>
  );
}

function findFirstRoute(items: any[]): string {
  if (!items || items.length === 0) return '';
  for (const item of items) {
    if (item.type === 'object') return item.viewName ? `${item.objectName}/view/${item.viewName}` : `${item.objectName}`;
    if (item.type === 'page') return item.pageName ? `page/${item.pageName}` : '';
    if (item.type === 'dashboard') return item.dashboardName ? `dashboard/${item.dashboardName}` : '';
    if (item.type === 'url') continue;
    if (item.type === 'group' && item.children) {
      const childRoute = findFirstRoute(item.children);
      if (childRoute !== '') return childRoute;
    }
  }
  return '';
}

// Build the per-item route segment without recursing through groups —
// used when `homePageId` resolved to an exact match and we just need to
// know how to address it.
function buildItemRoute(item: any): string {
  if (!item) return '';
  if (item.type === 'object') return item.viewName ? `${item.objectName}/view/${item.viewName}` : `${item.objectName}`;
  if (item.type === 'page') return item.pageName ? `page/${item.pageName}` : '';
  if (item.type === 'dashboard') return item.dashboardName ? `dashboard/${item.dashboardName}` : '';
  if (item.type === 'report') return item.reportName ? `report/${item.reportName}` : '';
  return '';
}

function findNavItemById(items: any[], id: string): any | undefined {
  if (!items) return undefined;
  for (const item of items) {
    if (item.id === id) return item;
    if (item.type === 'group' && item.children) {
      const hit = findNavItemById(item.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * Resolves the route to navigate to when the user lands on the bare
 * `/console/apps/:appName` URL. Honors the app's explicit
 * `homePageId` (Salesforce-style "Default Landing"); falls back to the
 * first reachable nav item only when no homePageId is set or it points
 * at something that doesn't yield a route. This is what lets the CRM
 * example open on the Sales Dashboard instead of the Lead list.
 */
function resolveLandingRoute(activeApp: any): string {
  const homePageId: string | undefined = activeApp?.homePageId;
  const navigation = activeApp?.navigation || [];
  if (homePageId) {
    const item = findNavItemById(navigation, homePageId);
    const route = buildItemRoute(item);
    if (route) return route;
  }
  return findFirstRoute(navigation);
}

/**
 * Heuristic: distinguish a record id from a route fragment.
 *
 * Record ids in this system are URL-safe slugs (alnum + `_` / `-`), typically
 * 8+ chars (often 16+). They never collide with reserved second-segment
 * keywords used by the route table (`new`, `view`, `record`, `dashboard`,
 * `report`, `page`, `design`, `search`, `create-app`, `edit-app`).
 */
const RESERVED_SECOND_SEGMENTS = new Set([
  'new', 'view', 'record', 'edit',
  'dashboard', 'report', 'page',
  'design', 'search', 'create-app', 'edit-app',
]);

function looksLikeRecordId(segment: string | undefined): boolean {
  if (!segment) return false;
  if (RESERVED_SECOND_SEGMENTS.has(segment)) return false;
  // Allow URL-safe slug chars; reject anything with `/`, `?`, `#`, spaces.
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return false;
  // Most record ids are at least 6 chars (UUID, ULID, nanoid all >=8).
  return segment.length >= 6;
}

/**
 * Redirects `/apps/:appName/:objectName/:recordId` shorthand to the
 * canonical `/apps/:appName/:objectName/record/:recordId` so externally
 * shared / pasted links work, and legacy URL producers that built the
 * shorthand keep functioning.
 */
function ShorthandRecordRedirect() {
  const { objectName, maybeRecordId } = useParams();
  const location = useLocation();
  if (objectName && looksLikeRecordId(maybeRecordId)) {
    const target = `${location.pathname.replace(/\/$/, '').replace(`/${maybeRecordId}`, `/record/${maybeRecordId}`)}${location.search}${location.hash}`;
    return <Navigate to={target} replace />;
  }
  return <RouteNotFound />;
}

/**
 * Visible "not found" fallback rendered for any unmatched URL inside the
 * console app shell. Previously these URLs produced a fully blank content
 * area with no indication that anything had gone wrong — users would think
 * the app had crashed. An explicit Empty state with a "back to app home"
 * action turns an opaque failure into a recoverable one.
 */
function RouteNotFound() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Empty>
        <EmptyTitle>{t('console.notFound.title', { defaultValue: 'Page not found' })}</EmptyTitle>
        <EmptyDescription>
          {t('console.notFound.description', { defaultValue: 'The URL you followed does not match any view in this app.' })}
        </EmptyDescription>
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            {t('console.notFound.back', { defaultValue: 'Go back' })}
          </Button>
        </div>
      </Empty>
    </div>
  );
}


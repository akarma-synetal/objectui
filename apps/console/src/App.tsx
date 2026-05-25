/**
 * ObjectStack Console — fork-ready runtime console template.
 *
 * Auth UI lives in the Account SPA at `/_account/*`. This file owns the
 * console routing tree only — sign-in / sign-up / forgot-password URLs are
 * shimmed to hard-redirect to Account, and the AuthGuard fallback bounces
 * unauthenticated visitors there too (preserving `?redirect=...`).
 *
 * Console-specific extras (system / settings / legacy metadata editor) are
 * injected via {@link AppContent}, which wraps `DefaultAppContent` with
 * extra `<Route>` children.
 */

import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthGuard, useAuth } from '@object-ui/auth';
import {
  ConsoleShell,
  ConnectedShell,
  RequireOrganization,
  SystemRedirect,
  LoadingFallback,
  ConsoleToaster,
  DefaultHomeLayout,
  DefaultHomePage,
  DefaultOrganizationsLayout,
  DefaultOrganizationsPage,
} from '@object-ui/app-shell';

import { AppContent } from './AppContent';
import { AccountLoginRedirect } from './components/AccountLoginRedirect';
import { CloudAwareRootRedirect } from './components/CloudAwareRootRedirect';
import { FormPage } from './components/FormPage';
import { MetadataHmrReloader } from './components/MetadataHmrReloader';
import { SignOutOverlay } from './components/SignOutOverlay';
import {
  gotoAccountLogin,
  gotoAccountRegister,
  gotoAccountForgotPassword,
} from './lib/auth-redirect';

const AUTH_URL = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

/**
 * Resolve the React Router basename.
 *
 * The published Console build uses a relative Vite base (`./`) so the
 * same `dist/` works under any mount path. That means `import.meta.env.BASE_URL`
 * is `./` and useless for routing — we derive the actual mount root
 * from `document.baseURI` at runtime instead.
 *
 * Hosts that embed the SPA should inject a `<base href="/path/">` into
 * the served HTML (the framework CLI does this automatically). Falls
 * back to `'/'` for dev / standalone deployments.
 */
function resolveBasename(): string {
  try {
    const url = new URL(document.baseURI);
    const path = url.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return '/';
  }
}

const BASENAME = resolveBasename();

/**
 * ProtectedRoute — replaces app-shell's AuthenticatedRoute. Same composition
 * (AuthGuard + ConnectedShell + optional RequireOrganization) but with an
 * external-redirect fallback instead of `<Navigate to="/login" />`.
 */
function ProtectedRoute({
  children,
  requireOrganization = true,
}: {
  children: ReactNode;
  requireOrganization?: boolean;
}) {
  return (
    <AuthGuard fallback={<AccountLoginRedirect />} loadingFallback={<LoadingFallback />}>
      <ConnectedShell>
        {requireOrganization ? <RequireOrganization>{children}</RequireOrganization> : children}
      </ConnectedShell>
    </AuthGuard>
  );
}

/** Redirect-only route shim: `/login` → Account, preserving any `?redirect=`. */
function LoginRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    gotoAccountLogin(params.get('redirect') ?? undefined);
  }, []);
  return <LoadingFallback />;
}

function RegisterRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    gotoAccountRegister(params.get('redirect') ?? undefined);
  }, []);
  return <LoadingFallback />;
}

function ForgotPasswordRedirect() {
  useEffect(() => {
    gotoAccountForgotPassword();
  }, []);
  return <LoadingFallback />;
}

/** Wraps `DefaultHomeLayout` so the FAB gets the signed-in user id. */
function HomeRoute() {
  const { user } = useAuth();
  return (
    <DefaultHomeLayout userId={user?.id}>
      <DefaultHomePage />
    </DefaultHomeLayout>
  );
}

export function App() {
  return (
    <AuthProvider authUrl={AUTH_URL}>
      <ConsoleToaster position="bottom-right" />
      <MetadataHmrReloader />
      <SignOutOverlay />
      <BrowserRouter basename={BASENAME}>
        <ConsoleShell>
          <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/register" element={<RegisterRedirect />} />
            <Route path="/forgot-password" element={<ForgotPasswordRedirect />} />
            {/*
              * Public anonymous form — rendered OUTSIDE ProtectedRoute so
              * unauthenticated visitors can submit. The slug maps 1:1 to a
              * FormView whose `sharing.allowAnonymous === true`.
              */}
            <Route path="/f/:slug" element={<FormPage mode="public" />} />
            {/* Internal authed form — same renderer, different submit path. */}
            <Route path="/forms/:name" element={
              <ProtectedRoute>
                <FormPage mode="internal" />
              </ProtectedRoute>
            } />
            <Route path="/home" element={
              <ProtectedRoute>
                <HomeRoute />
              </ProtectedRoute>
            } />
            <Route path="/organizations" element={
              <ProtectedRoute requireOrganization={false}>
                <DefaultOrganizationsLayout><DefaultOrganizationsPage /></DefaultOrganizationsLayout>
              </ProtectedRoute>
            } />
            <Route path="/system/*" element={<SystemRedirect />} />
            <Route path="/apps/:appName/*" element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            } />
            <Route path="/" element={<ConnectedShell><CloudAwareRootRedirect /></ConnectedShell>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConsoleShell>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Re-export AppContent so tests/extenders that import { AppContent } from './App'
// keep working.
export { AppContent } from './AppContent';

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Suspense, lazy, useEffect } from 'react';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
// AiChatPanel pulls in `@object-ui/plugin-chatbot` → streamdown → shiki, which
// ships ~23MB of TextMate grammars. The panel is opt-in (Toggle AI Chat button),
// so we lazy-load it and only mount when actually opened — the rest of Studio
// no longer pays the cost on first paint. See `@/lib/prefetch-ai-chat` for
// the speculative warm-up helper wired into the toolbar button.
const AiChatPanel = lazy(() =>
  import('@/components/AiChatPanel').then((m) => ({ default: m.AiChatPanel })),
);
import { ProductionGuardProvider } from '@/components/production-guard';
import { StudioShell } from '@/components/StudioShell';
import { StudioAccessDenied } from '@/components/StudioAccessDenied';
import { PluginRegistryProvider } from '../plugins';
import { builtInPlugins } from '../plugins/built-in';
import { useObjectStackClient } from '../hooks/useObjectStackClient';
import { SessionProvider, useSession } from '../hooks/useSession';
import { gotoAccountLogin } from '@/lib/auth-redirect';
import { useAiChatPanel } from '@/hooks/use-ai-chat-panel';

/**
 * Single-tenant Studio shell. Login is delegated to apps/account; if the
 * session call comes back empty we bounce there. Studio is the
 * developer/admin surface of ObjectStack and requires `user.role ===
 * 'admin'` — non-admins get a friendly stop page instead of being
 * silently bounced into a login loop.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      gotoAccountLogin(window.location.pathname + window.location.search);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Admin gate — Studio is not for ordinary end users.
  if (user.role !== 'admin') {
    return (
      <StudioAccessDenied
        user={user}
        onSwitchAccount={async () => {
          await logout();
          gotoAccountLogin(window.location.pathname + window.location.search);
        }}
      />
    );
  }

  return (
    <SidebarProvider>
      <StudioShell>{children}</StudioShell>
    </SidebarProvider>
  );
}

function AuthedAiChatPanel() {
  const { user } = useSession();
  const { isOpen } = useAiChatPanel();
  // Defer the heavy chunk (shiki, streamdown, etc.) until the panel is
  // actually opened. AiChatPanel internally hides itself when !isOpen,
  // but mounting it at all is what triggers the dynamic import.
  if (!user || user.role !== 'admin' || !isOpen) return null;
  return (
    <Suspense fallback={null}>
      <AiChatPanel />
    </Suspense>
  );
}

function RootComponent() {
  const client = useObjectStackClient();

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Connecting to ObjectStack…</p>
        </div>
      </div>
    );
  }

  return (
    <ObjectStackProvider client={client}>
      <SessionProvider>
        <PluginRegistryProvider plugins={builtInPlugins}>
          <ErrorBoundary>
            <ProductionGuardProvider>
              <RequireAuth>
                <Outlet />
              </RequireAuth>
              <Toaster />
              <AuthedAiChatPanel />
            </ProductionGuardProvider>
          </ErrorBoundary>
        </PluginRegistryProvider>
      </SessionProvider>
    </ObjectStackProvider>
  );
}

export const Route = createRootRoute({ component: RootComponent });

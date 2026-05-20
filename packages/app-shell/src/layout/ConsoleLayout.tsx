/**
 * ConsoleLayout
 *
 * Root layout shell for the console application. Composes the AppShell
 * with the UnifiedSidebar, header, and main content area.
 * Includes the global floating chatbot (FAB) widget.
 * Sets navigation context to 'app' for app-specific routes.
 * @module
 */

import React, { useEffect, Suspense, lazy } from 'react';
import { AppShell } from '@object-ui/layout';
import { useDiscovery } from '@object-ui/react';

// Lazy-load the chatbot so its heavy markdown deps (~150 KB) stay out of
// the initial paint until the AI assistant is actually enabled.
const ConsoleFloatingChatbot = lazy(() => import('./ConsoleFloatingChatbot'));
import { UnifiedSidebar } from './UnifiedSidebar';
import { AppHeader } from './AppHeader';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import { useNavigationContext } from '../context/NavigationContext';
import { resolveI18nLabel } from '../utils';
import type { ConnectionState } from '@object-ui/data-objectstack';

/** Minimal object shape used by the chatbot context */
interface ConsoleObject {
  name: string;
  label?: string;
}

interface ConsoleLayoutProps {
  children: React.ReactNode;
  activeAppName: string;
  activeApp: any;
  onAppChange: (name: string) => void;
  objects: any[];
  connectionState?: ConnectionState;
}

/** Inner component that can access SidebarProvider context */
function ConsoleLayoutInner({ children }: { children: React.ReactNode }) {
  useResponsiveSidebar();
  return <>{children}</>;
}

/** Floating chatbot wired with useObjectChat for demo auto-response */
// (moved to ./ConsoleFloatingChatbot.tsx for code-splitting)

export function ConsoleLayout({
  children,
  activeAppName,
  activeApp,
  onAppChange,
  objects,
  connectionState
}: ConsoleLayoutProps) {
  const appLabel = resolveI18nLabel(activeApp?.label) || activeAppName;
  const { isAiEnabled } = useDiscovery();
  // Trust an explicit `VITE_AI_BASE_URL` opt-in even when discovery reports
  // AI as disabled (e.g. framework started without `--preset full`).
  const aiBaseUrlConfigured = Boolean(import.meta.env?.VITE_AI_BASE_URL);
  const showChatbot = isAiEnabled || aiBaseUrlConfigured;
  const { setContext, setCurrentAppName } = useNavigationContext();

  // Set navigation context to 'app' when this layout mounts
  useEffect(() => {
    setContext('app');
    setCurrentAppName(activeAppName);
  }, [setContext, setCurrentAppName, activeAppName]);

  return (
    <AppShell
      sidebar={
         <UnifiedSidebar
           activeAppName={activeAppName}
           onAppChange={onAppChange}
         />
      }
      navbar={
          <AppHeader
            variant="app"
            appName={appLabel}
            objects={objects}
            connectionState={connectionState}
            activeAppName={activeAppName}
            onAppChange={onAppChange}
          />
      }
      className="!p-0 overflow-y-auto overflow-x-hidden bg-muted/5"
      branding={
        activeApp?.branding
          ? {
              primaryColor: activeApp.branding.primaryColor,
              accentColor: activeApp.branding.accentColor,
              favicon: activeApp.branding.favicon,
              logo: activeApp.branding.logo,
              title: activeApp.label
                ? `${resolveI18nLabel(activeApp.label)} — ObjectStack Console`
                : undefined,
            }
          : undefined
      }
    >
      <ConsoleLayoutInner>
        {children}
      </ConsoleLayoutInner>

      {/* Global floating chatbot — rendered when AI service is available
          OR when `VITE_AI_BASE_URL` has been explicitly configured. */}
      {showChatbot && (
        <Suspense fallback={null}>
          <ConsoleFloatingChatbot appLabel={appLabel} objects={objects} />
        </Suspense>
      )}
    </AppShell>
  );
}

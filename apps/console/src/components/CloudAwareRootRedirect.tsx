// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CloudAwareRootRedirect — element for `<Route path="/" />`.
 *
 * Replaces app-shell's stock `RootRedirect` (which always sends to
 * `/home`). The same Console bundle is served by both apps/cloud
 * (control plane) and apps/objectos (per-project runtime); we want
 * each to land on the most useful App for that host without baking
 * a Vite env var into the build.
 *
 * Strategy: inspect the loaded metadata `apps` list and prefer a
 * cloud-control App when present (apps/cloud). Otherwise fall back
 * to `/home`, preserving the legacy behaviour for apps/objectos.
 *
 * Preference order:
 *   1. `cloud_control`  — apps/cloud's control plane App
 *   2. `setup`          — apps/cloud second-best fallback
 *   3. `/home`          — original RootRedirect behaviour
 */

import { Navigate } from 'react-router-dom';
import { useMetadata, LoadingFallback } from '@object-ui/app-shell';

const PREFERRED_APPS = ['cloud_control'];

export function CloudAwareRootRedirect() {
  const { apps, loading } = useMetadata();
  if (loading) return <LoadingFallback />;

  const appNames = new Set((apps ?? []).map((a: any) => a?.name).filter(Boolean));
  for (const candidate of PREFERRED_APPS) {
    if (appNames.has(candidate)) {
      return <Navigate to={`/apps/${candidate}`} replace />;
    }
  }

  return <Navigate to="/home" replace />;
}

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useAuth } from './useAuth';

/**
 * Returns true when the current user has owner/admin role on the active
 * organization. Defaults to `false` until the active member row has loaded —
 * this avoids flashing admin-only UI to regular members on first paint.
 *
 * In preview-mode / no-auth-enabled mode the provider seeds an admin member,
 * so this returns `true` for dev/demo setups.
 */
export function useIsWorkspaceAdmin(): boolean {
  const { activeMember } = useAuth();
  const role = String(activeMember?.role ?? '').toLowerCase();
  return role === 'owner' || role === 'admin';
}

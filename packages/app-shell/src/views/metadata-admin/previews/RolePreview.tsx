// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RolePreview — read-only summary of a Role draft.
 *
 * The Role schema is intentionally minimal — name / label / parent /
 * description. The preview's job is therefore to put those four
 * fields into the mental model an operator carries:
 *
 *   • Header card with label and machine name.
 *   • Hierarchy breadcrumb — the role itself plus a chip for the
 *     declared parent. We cannot resolve the full chain from a single
 *     draft, but we surface the immediate parent prominently.
 *   • Description block.
 *   • A "permissions are managed separately" note pointing the user
 *     to PermissionSets / Profiles that grant CRUD-VAMA — this is
 *     the most common confusion when first authoring a role.
 */

import * as React from 'react';
import { CornerDownRight, IdCard, ShieldCheck, Users } from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

export function RolePreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const roleName = String(d.name ?? name ?? '');
  const label = String(d.label ?? roleName);
  const description = (d.description as string | undefined) ?? '';
  const parent = d.parent as string | undefined;

  if (!roleName) {
    return (
      <PreviewShell hint="role">
        <PreviewMessage>Give the role a name to see the preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint="role">
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{roleName}</span>
                </div>
                {description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                )}
              </div>
            </div>
          </div>

          {/* Hierarchy */}
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Hierarchy
            </div>
            <div className="rounded border bg-background p-2.5 text-xs">
              {parent ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Parent:</span>
                    <code className="font-mono">{parent}</code>
                  </div>
                  <div className="flex items-center gap-1.5 pl-4">
                    <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-mono text-emerald-800">
                      {roleName}
                    </span>
                    <span className="text-[10px] text-muted-foreground italic">this role</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1">
                    Open the parent role to walk further up the chain.
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-mono text-emerald-800">
                    {roleName}
                  </span>
                  <span className="text-[10px] text-muted-foreground italic">root role — no parent</span>
                </div>
              )}
            </div>
          </div>

          {/* Permissions note */}
          <div className="rounded border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-blue-900">
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Roles don't grant data access on their own.</div>
                <div className="opacity-90 mt-0.5">
                  Bind <code className="font-mono">{roleName}</code> to one or more <strong>Permission Sets</strong>{' '}
                  or assign it to a <strong>Profile</strong> to control CRUD-VAMA, field access, and tab visibility.
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

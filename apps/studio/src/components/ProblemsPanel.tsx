// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Problems panel — bottom status bar + slide-up tray.
 *
 *   • Status bar (always visible): error/warning counts and a "Problems"
 *     button that toggles the tray.
 *   • Tray (collapsible): grouped list of cross-reference issues. Each
 *     row deep-links to the offending metadata item.
 *
 * Toggle with `[` (handled by useStudioHotkeys) or click the status bar.
 */

import { Link } from '@tanstack/react-router';
import { AlertCircle, AlertTriangle, Info, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProblems, type ProblemSeverity } from '@/hooks/useProblems';

function severityIcon(s: ProblemSeverity) {
  if (s === 'error')
    return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  if (s === 'warning')
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function ProblemsStatusBar() {
  const { problems, loading, open, toggle } = useProblems();
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.filter((p) => p.severity === 'warning').length;
  const hasIssues = errors > 0 || warnings > 0;
  return (
    <button
      onClick={toggle}
      className="h-6 px-2 inline-flex items-center gap-2 text-xs hover:bg-muted/60 rounded transition-colors"
      aria-pressed={open}
      title={`${problems.length} problem(s). Toggle with [`}
    >
      {hasIssues && (
        <>
          {errors > 0 && (
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors}
            </span>
          )}
          {warnings > 0 && (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {warnings}
            </span>
          )}
        </>
      )}
      <span className="text-muted-foreground hidden sm:inline">
        {hasIssues ? 'Problems' : 'No problems'}
        {loading ? '…' : ''}
      </span>
      <kbd className="hidden md:inline px-1 rounded bg-muted text-[10px]">[</kbd>
    </button>
  );
}

export function ProblemsPanel() {
  const { problems, loading, open, setOpen, refresh } = useProblems();
  if (!open) return null;

  const grouped = new Map<ProblemSeverity, typeof problems>();
  for (const p of problems) {
    if (!grouped.has(p.severity)) grouped.set(p.severity, []);
    grouped.get(p.severity)!.push(p);
  }

  return (
    <div className="border-t bg-background flex flex-col max-h-[40vh]">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Problems</span>
          <Badge variant="outline">{problems.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refresh()}
            disabled={loading}
            title="Re-scan"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {problems.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            ✨ No problems detected. Cross-reference scan clean.
          </div>
        )}
        {(['error', 'warning', 'info'] as ProblemSeverity[]).map((sev) => {
          const items = grouped.get(sev) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={sev}>
              {items.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-2 px-3 py-1.5 border-b hover:bg-muted/40 text-sm"
                >
                  <div className="pt-0.5">{severityIcon(p.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {p.type}
                      </Badge>
                      {p.packageId ? (
                        <Link
                          to="/$package/metadata/$type/$name"
                          params={{
                            package: p.packageId,
                            type: p.type,
                            name: p.name,
                          }}
                          className="font-mono text-xs hover:underline underline-offset-2"
                          onClick={() => setOpen(false)}
                        >
                          {p.name}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{p.name}</span>
                      )}
                    </div>
                    <div className="text-foreground/90">{p.message}</div>
                    {p.hint && (
                      <div className="text-xs text-muted-foreground">{p.hint}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

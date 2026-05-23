// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Keyboard shortcuts help dialog. Triggered by `?` or via the command
 * palette. Lists every shortcut registered in `useStudioHotkeys`.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { STUDIO_SHORTCUTS } from '@/hooks/useStudioHotkeys';

interface HotkeysHelpDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function HotkeysHelpDialog({ open, onOpenChange }: HotkeysHelpDialogProps) {
  const groups = new Map<string, typeof STUDIO_SHORTCUTS>();
  for (const s of STUDIO_SHORTCUTS) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    (groups.get(s.group) as any).push(s);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Most shortcuts use the <kbd className="px-1 rounded bg-muted text-xs">g</kbd>{' '}
            prefix for "go to". Keys are ignored while typing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-auto">
          {[...groups.entries()].map(([group, items]) => (
            <div key={group}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                {group}
              </div>
              <ul className="space-y-1">
                {items.map((s) => (
                  <li
                    key={s.keys + s.label}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span>{s.label}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

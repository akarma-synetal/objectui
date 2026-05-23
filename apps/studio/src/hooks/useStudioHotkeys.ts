// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Global keyboard shortcuts for Studio. Linear / VS Code-style:
 *
 *   ⌘K / Ctrl+K         Command palette (handled by CommandPalette itself)
 *   g + o/f/v/a/i/s/p/l Go to Objects/Forms/Views/Automations/Ai/Security/Playground/Logs
 *   ]                   Toggle right Inspector drawer
 *   [                   Toggle bottom Problems panel
 *   ?                   Show keyboard shortcuts help
 *
 * Keys are ignored while typing in an input/textarea/contenteditable so
 * the shortcuts don't interfere with text entry.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from '@tanstack/react-router';

interface UseStudioHotkeysOptions {
  toggleInspector: () => void;
  toggleProblems: () => void;
  openHelp: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useStudioHotkeys({
  toggleInspector,
  toggleProblems,
  openHelp,
}: UseStudioHotkeysOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false }) as { package?: string };
  const lastG = useRef<number>(0);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Two-key "g <x>" sequences. Within 1.2s after pressing g, treat
      // the next key as the target.
      const now = Date.now();
      if (e.key.toLowerCase() === 'g') {
        lastG.current = now;
        return;
      }
      if (now - lastG.current < 1200 && lastG.current > 0) {
        const pkg = params.package;
        const map: Record<string, string> = {
          o: 'objects',
          f: 'forms',
          v: 'views',
          a: 'automations',
          i: 'ai',
          s: 'security',
          p: 'playground',
          l: 'logs',
          h: '',
        };
        const dest = map[e.key.toLowerCase()];
        if (pkg && dest !== undefined) {
          lastG.current = 0;
          e.preventDefault();
          navigate({ to: dest ? `/${pkg}/${dest}` : `/${pkg}` });
          return;
        }
      }

      if (e.key === ']') {
        e.preventDefault();
        toggleInspector();
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        toggleProblems();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        openHelp();
        return;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, params.package, toggleInspector, toggleProblems, openHelp, location.pathname]);
}

export interface ShortcutSpec {
  keys: string;
  label: string;
  group: string;
}

export const STUDIO_SHORTCUTS: readonly ShortcutSpec[] = [
  { keys: '⌘K', label: 'Open command palette', group: 'Global' },
  { keys: '?', label: 'Show this help', group: 'Global' },
  { keys: ']', label: 'Toggle Inspector drawer', group: 'Layout' },
  { keys: '[', label: 'Toggle Problems panel', group: 'Layout' },
  { keys: 'g h', label: 'Go to Home', group: 'Navigation' },
  { keys: 'g o', label: 'Go to Objects', group: 'Navigation' },
  { keys: 'g f', label: 'Go to Forms', group: 'Navigation' },
  { keys: 'g v', label: 'Go to Views & Apps', group: 'Navigation' },
  { keys: 'g a', label: 'Go to Automations', group: 'Navigation' },
  { keys: 'g i', label: 'Go to AI', group: 'Navigation' },
  { keys: 'g s', label: 'Go to Security', group: 'Navigation' },
  { keys: 'g p', label: 'Go to Playground', group: 'Navigation' },
  { keys: 'g l', label: 'Go to Logs', group: 'Navigation' },
];

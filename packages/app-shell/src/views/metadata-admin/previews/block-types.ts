// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Catalog of Page-block types, mirrored from the framework's Page
 * schema (`regions[].components[].type` enum). Grouped + iconified
 * for the picker UI in PageBlockCanvas.
 *
 * Source of truth: keep the IDs in sync with
 * `@objectstack/spec`'s page protocol. New block types appear in the
 * `Other` category by default — add a META entry to give them an icon.
 */

import {
  Heading1,
  PanelTop,
  PanelBottom,
  PanelLeft,
  Folders,
  ChevronsUpDown,
  Square,
  Layers,
  FileText,
  Tag,
  ListChecks,
  Activity,
  MessageSquare,
  Compass,
  AlertTriangle,
  Zap,
  BookOpen,
  History,
  Rocket,
  Menu,
  Search,
  Bell,
  User,
  Bot,
  Sparkles,
  Type,
  Hash,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  Filter,
  ClipboardList,
  Target,
  Box,
  type LucideIcon,
} from 'lucide-react';

export type BlockTypeId =
  // page:*
  | 'page:header' | 'page:footer' | 'page:sidebar' | 'page:tabs'
  | 'page:accordion' | 'page:card' | 'page:section'
  // record:*
  | 'record:details' | 'record:highlights' | 'record:related_list'
  | 'record:activity' | 'record:chatter' | 'record:path' | 'record:alert'
  | 'record:quick_actions' | 'record:reference_rail' | 'record:history'
  // app:*
  | 'app:launcher'
  // nav:*
  | 'nav:menu' | 'nav:breadcrumb'
  // global:*
  | 'global:search' | 'global:notifications'
  // user:*
  | 'user:profile'
  // ai:*
  | 'ai:chat_window' | 'ai:suggestion'
  // element:*
  | 'element:text' | 'element:number' | 'element:image' | 'element:divider'
  | 'element:button' | 'element:filter' | 'element:form' | 'element:record_picker';

export type BlockCategory = 'layout' | 'record' | 'navigation' | 'element' | 'ai' | 'misc';

export interface BlockTypeMeta {
  id: BlockTypeId;
  label: string;
  category: BlockCategory;
  Icon: LucideIcon;
}

export const BLOCK_TYPE_META: Record<BlockTypeId, Omit<BlockTypeMeta, 'id'>> = {
  // Page layout
  'page:header':    { label: 'Header',    category: 'layout', Icon: PanelTop },
  'page:footer':    { label: 'Footer',    category: 'layout', Icon: PanelBottom },
  'page:sidebar':   { label: 'Sidebar',   category: 'layout', Icon: PanelLeft },
  'page:tabs':      { label: 'Tabs',      category: 'layout', Icon: Folders },
  'page:accordion': { label: 'Accordion', category: 'layout', Icon: ChevronsUpDown },
  'page:card':      { label: 'Card',      category: 'layout', Icon: Square },
  'page:section':   { label: 'Section',   category: 'layout', Icon: Layers },

  // Record context
  'record:details':         { label: 'Record details',      category: 'record', Icon: FileText },
  'record:highlights':      { label: 'Highlights',          category: 'record', Icon: Tag },
  'record:related_list':    { label: 'Related list',        category: 'record', Icon: ListChecks },
  'record:activity':        { label: 'Activity timeline',   category: 'record', Icon: Activity },
  'record:chatter':         { label: 'Chatter feed',        category: 'record', Icon: MessageSquare },
  'record:path':            { label: 'Stage path',          category: 'record', Icon: Compass },
  'record:alert':           { label: 'Alert banner',        category: 'record', Icon: AlertTriangle },
  'record:quick_actions':   { label: 'Quick actions',       category: 'record', Icon: Zap },
  'record:reference_rail':  { label: 'Reference rail',      category: 'record', Icon: BookOpen },
  'record:history':         { label: 'History',             category: 'record', Icon: History },

  // App & navigation
  'app:launcher':       { label: 'App launcher',        category: 'navigation', Icon: Rocket },
  'nav:menu':           { label: 'Nav menu',            category: 'navigation', Icon: Menu },
  'nav:breadcrumb':     { label: 'Breadcrumb',          category: 'navigation', Icon: Compass },
  'global:search':      { label: 'Global search',       category: 'navigation', Icon: Search },
  'global:notifications': { label: 'Notifications',     category: 'navigation', Icon: Bell },
  'user:profile':       { label: 'User profile',        category: 'navigation', Icon: User },

  // AI
  'ai:chat_window':     { label: 'AI chat window',      category: 'ai', Icon: Bot },
  'ai:suggestion':      { label: 'AI suggestion',       category: 'ai', Icon: Sparkles },

  // Elements
  'element:text':           { label: 'Text',            category: 'element', Icon: Type },
  'element:number':         { label: 'Number',          category: 'element', Icon: Hash },
  'element:image':          { label: 'Image',           category: 'element', Icon: ImageIcon },
  'element:divider':        { label: 'Divider',         category: 'element', Icon: Minus },
  'element:button':         { label: 'Button',          category: 'element', Icon: MousePointerClick },
  'element:filter':         { label: 'Filter',          category: 'element', Icon: Filter },
  'element:form':           { label: 'Form',            category: 'element', Icon: ClipboardList },
  'element:record_picker':  { label: 'Record picker',   category: 'element', Icon: Target },
};

export const CATEGORY_LABEL_EN: Record<BlockCategory, string> = {
  layout:     'Layout',
  record:     'Record context',
  navigation: 'Navigation',
  element:    'Elements',
  ai:         'AI',
  misc:       'Other',
};

export const TYPES_BY_CATEGORY: Array<{ category: BlockCategory; types: BlockTypeId[] }> = (() => {
  const out: Record<BlockCategory, BlockTypeId[]> = {
    layout: [], record: [], navigation: [], element: [], ai: [], misc: [],
  };
  for (const [id, meta] of Object.entries(BLOCK_TYPE_META)) {
    out[meta.category].push(id as BlockTypeId);
  }
  return (['layout', 'record', 'element', 'navigation', 'ai', 'misc'] as BlockCategory[])
    .map((c) => ({ category: c, types: out[c] }))
    .filter((g) => g.types.length > 0);
})();

/** Fallback icon for unknown block types. */
export const UnknownBlockIcon = Box;

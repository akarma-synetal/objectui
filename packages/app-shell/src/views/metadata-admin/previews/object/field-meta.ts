// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Lightweight catalog of field types for the Airtable-style FieldsTable:
 * label, group, icon name (lucide), and a one-line sample value for the
 * empty-state preview row. Mirrors the canonical FieldType enum in
 * packages/spec/src/data/field.zod.ts — additions there should be
 * mirrored here.
 */

export type FieldGroup =
  | 'text'
  | 'rich'
  | 'number'
  | 'datetime'
  | 'logic'
  | 'select'
  | 'relational'
  | 'media'
  | 'computed'
  | 'structured'
  | 'enhanced'
  | 'ai';

export interface FieldTypeMeta {
  type: string;
  label: string;
  group: FieldGroup;
  /** Lucide icon name (kebab-case if multi-word). */
  icon: string;
  sample: string;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  // Text
  { type: 'text',       label: 'Single line',  group: 'text',  icon: 'type',         sample: 'Hello' },
  { type: 'textarea',   label: 'Long text',    group: 'text',  icon: 'align-left',   sample: 'Lorem ipsum…' },
  { type: 'email',      label: 'Email',        group: 'text',  icon: 'mail',         sample: 'user@example.com' },
  { type: 'url',        label: 'URL',          group: 'text',  icon: 'link',         sample: 'https://…' },
  { type: 'phone',      label: 'Phone',        group: 'text',  icon: 'phone',        sample: '+1 555-0100' },
  { type: 'password',   label: 'Password',     group: 'text',  icon: 'key-round',    sample: '••••••••' },
  // Rich
  { type: 'markdown',   label: 'Markdown',     group: 'rich',  icon: 'file-text',    sample: '# Heading' },
  { type: 'html',       label: 'HTML',         group: 'rich',  icon: 'code-2',       sample: '<p>…</p>' },
  { type: 'richtext',   label: 'Rich text',    group: 'rich',  icon: 'pen-line',     sample: 'Formatted…' },
  // Number
  { type: 'number',     label: 'Number',       group: 'number', icon: 'hash',         sample: '42' },
  { type: 'currency',   label: 'Currency',     group: 'number', icon: 'dollar-sign',  sample: '$1,234.56' },
  { type: 'percent',    label: 'Percent',      group: 'number', icon: 'percent',      sample: '12.5%' },
  // Date/Time
  { type: 'date',       label: 'Date',         group: 'datetime', icon: 'calendar',   sample: '2026-05-29' },
  { type: 'datetime',   label: 'Date & time',  group: 'datetime', icon: 'calendar-clock', sample: '2026-05-29 09:30' },
  { type: 'time',       label: 'Time',         group: 'datetime', icon: 'clock',      sample: '09:30' },
  // Logic
  { type: 'boolean',    label: 'Checkbox',     group: 'logic', icon: 'square-check', sample: '✓' },
  { type: 'toggle',     label: 'Toggle',       group: 'logic', icon: 'toggle-right', sample: 'on' },
  // Selection
  { type: 'select',      label: 'Single select', group: 'select', icon: 'chevron-down-circle', sample: 'Option A' },
  { type: 'multiselect', label: 'Multi select',  group: 'select', icon: 'list-checks',         sample: 'A, B' },
  { type: 'radio',       label: 'Radio',         group: 'select', icon: 'circle-dot',          sample: '◉' },
  { type: 'checkboxes',  label: 'Checkboxes',    group: 'select', icon: 'check-square',        sample: '☑ ☑ ☐' },
  // Relational
  { type: 'lookup',        label: 'Lookup',         group: 'relational', icon: 'link-2',     sample: '→ Account' },
  { type: 'master_detail', label: 'Master-detail',  group: 'relational', icon: 'git-merge',  sample: '⤴ Parent' },
  { type: 'tree',          label: 'Tree',           group: 'relational', icon: 'git-fork',   sample: 'A › B › C' },
  // Media
  { type: 'image',  label: 'Image',  group: 'media', icon: 'image',        sample: '🖼️' },
  { type: 'file',   label: 'File',   group: 'media', icon: 'paperclip',    sample: '📎 doc.pdf' },
  { type: 'avatar', label: 'Avatar', group: 'media', icon: 'user-round',   sample: '👤' },
  { type: 'video',  label: 'Video',  group: 'media', icon: 'video',        sample: '▶' },
  { type: 'audio',  label: 'Audio',  group: 'media', icon: 'music-2',      sample: '♫' },
  // Computed
  { type: 'formula',    label: 'Formula',     group: 'computed', icon: 'function-square', sample: 'ƒx' },
  { type: 'summary',    label: 'Roll-up',     group: 'computed', icon: 'sigma',           sample: 'Σ' },
  { type: 'autonumber', label: 'Auto-number', group: 'computed', icon: 'binary',          sample: '#0001' },
  // Structured
  { type: 'composite', label: 'Composite', group: 'structured', icon: 'package',        sample: '{ … }' },
  { type: 'repeater',  label: 'Repeater',  group: 'structured', icon: 'rows-3',         sample: '[ … ]' },
  // Enhanced
  { type: 'location',  label: 'Location',  group: 'enhanced', icon: 'map-pin',          sample: '📍 lat,lng' },
  { type: 'address',   label: 'Address',   group: 'enhanced', icon: 'map',              sample: '1 Main St' },
  { type: 'code',      label: 'Code',      group: 'enhanced', icon: 'code',             sample: '{...}' },
  { type: 'json',      label: 'JSON',      group: 'enhanced', icon: 'braces',           sample: '{ "k": 1 }' },
  { type: 'color',     label: 'Color',     group: 'enhanced', icon: 'palette',          sample: '#0EA5E9' },
  { type: 'rating',    label: 'Rating',    group: 'enhanced', icon: 'star',             sample: '★★★★☆' },
  { type: 'slider',    label: 'Slider',    group: 'enhanced', icon: 'sliders-horizontal', sample: '———|—' },
  { type: 'signature', label: 'Signature', group: 'enhanced', icon: 'signature',        sample: '~Signed~' },
  { type: 'qrcode',    label: 'QR Code',   group: 'enhanced', icon: 'qr-code',          sample: '▦' },
  { type: 'progress',  label: 'Progress',  group: 'enhanced', icon: 'loader',           sample: '70%' },
  { type: 'tags',      label: 'Tags',      group: 'enhanced', icon: 'tags',             sample: '#a #b' },
  // AI
  { type: 'vector',    label: 'Vector',    group: 'ai', icon: 'sparkles', sample: '[1536d]' },
];

const BY_TYPE = new Map(FIELD_TYPES.map((m) => [m.type, m]));

export function fieldTypeMeta(type: string | undefined | null): FieldTypeMeta {
  if (!type) return FIELD_TYPES[0];
  return BY_TYPE.get(type) ?? {
    type,
    label: type,
    group: 'text',
    icon: 'help-circle',
    sample: '—',
  };
}

export const FIELD_GROUPS: { id: FieldGroup; label: string }[] = [
  { id: 'text',       label: 'Text' },
  { id: 'rich',       label: 'Rich content' },
  { id: 'number',     label: 'Number' },
  { id: 'datetime',   label: 'Date & time' },
  { id: 'logic',      label: 'Logic' },
  { id: 'select',     label: 'Selection' },
  { id: 'relational', label: 'Relational' },
  { id: 'media',      label: 'Media' },
  { id: 'computed',   label: 'Computed' },
  { id: 'structured', label: 'Embedded' },
  { id: 'enhanced',   label: 'Enhanced' },
  { id: 'ai',         label: 'AI / ML' },
];

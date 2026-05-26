// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata admin i18n bundle (Phase 3f).
 *
 * Lightweight static label table for the 27 built-in metadata types,
 * plus a tiny `t()` helper for engine UI strings.
 *
 * Why not i18next? The engine already consumes `label` from the
 * server's `/meta/types` response (which is sourced from
 * `DEFAULT_METADATA_TYPE_REGISTRY`). This bundle exists as a fallback
 * for environments without translation bundles configured, and as the
 * single source of truth for Chinese labels until the platform's
 * `setup.translation.ts` ships zh-CN coverage.
 *
 * Usage:
 *   import { translateMetadataType, t } from './i18n';
 *   translateMetadataType('view', 'zh-CN')  // → '视图'
 *   t('engine.directory.title', 'zh-CN')    // → '元数据'
 *
 * The DirectoryPage / PageShell call these to localise headings when
 * the consumer hasn't wired the global i18n provider.
 */

export type SupportedLocale = 'en-US' | 'zh-CN';

const TYPE_LABELS_EN: Record<string, string> = {
  // Data
  object: 'Object',
  field: 'Field',
  trigger: 'Trigger',
  validation: 'Validation Rule',
  hook: 'Hook',
  // UI
  view: 'View',
  page: 'Page',
  dashboard: 'Dashboard',
  app: 'Application',
  action: 'Action',
  report: 'Report',
  // Automation
  flow: 'Flow',
  workflow: 'Workflow',
  approval: 'Approval Process',
  // System
  datasource: 'Datasource',
  translation: 'Translation',
  router: 'Router',
  function: 'Function',
  service: 'Service',
  email_template: 'Email Template',
  // Security
  permission: 'Permission Set',
  profile: 'Profile',
  role: 'Role',
  // AI
  agent: 'AI Agent',
  tool: 'AI Tool',
  skill: 'AI Skill',
  // Platform
  package: 'Package',
  data: 'Dataset',
};

const TYPE_LABELS_ZH: Record<string, string> = {
  object: '对象',
  field: '字段',
  trigger: '触发器',
  validation: '校验规则',
  hook: '钩子',
  view: '视图',
  page: '页面',
  dashboard: '仪表板',
  app: '应用',
  action: '操作',
  report: '报表',
  flow: '流程',
  workflow: '工作流',
  approval: '审批流程',
  datasource: '数据源',
  translation: '翻译',
  router: '路由',
  function: '函数',
  service: '服务',
  email_template: '邮件模板',
  permission: '权限集',
  profile: '配置文件',
  role: '角色',
  agent: 'AI 智能体',
  tool: 'AI 工具',
  skill: 'AI 技能',
  package: '包',
  data: '数据集',
};

const DOMAIN_LABELS_EN: Record<string, string> = {
  data: 'Data',
  ui: 'UI',
  automation: 'Automation',
  ai: 'AI',
  system: 'System',
  platform: 'Platform',
  identity: 'Identity',
  security: 'Security',
  other: 'Other',
};

const DOMAIN_LABELS_ZH: Record<string, string> = {
  data: '数据',
  ui: '界面',
  automation: '自动化',
  ai: 'AI',
  system: '系统',
  platform: '平台',
  identity: '身份',
  security: '安全',
  other: '其他',
};

const ENGINE_STRINGS_EN: Record<string, string> = {
  'engine.directory.title': 'All Metadata Types',
  'engine.directory.description':
    'The platform protocol exposes {count} metadata types ({writable} writable at runtime). Click any tile to browse, override, or create instances.',
  'engine.directory.search': 'Search metadata types…',
  'engine.directory.writableOnly': 'Writable only',
  'engine.directory.quickFind': 'Quick Find',
  'engine.directory.noMatches': 'No matches',
  'engine.directory.noMatchesHint': 'Adjust your search or filters to see more metadata types.',
  'engine.directory.loading': 'Loading metadata types…',
  'engine.directory.loadFailed': 'Failed to load metadata types',
  'engine.directory.all': 'All',
  'engine.list.create': 'New',
  'engine.list.refresh': 'Refresh',
  'engine.list.search': 'Search name, label, description…',
  'engine.list.empty': 'No items yet.',
  'engine.list.items': 'Items',
  'engine.list.filtered': 'Filtered',
  'engine.list.allSources': 'All sources',
  'engine.list.col.name': 'Name',
  'engine.list.col.label': 'Label',
  'engine.list.col.source': 'Source',
  'engine.list.col.object': 'Object',
  'engine.list.col.type': 'Type',
  'engine.edit.save': 'Save',
  'engine.edit.reset': 'Reset overlay',
  'engine.edit.history': 'History',
  'engine.edit.layers': 'Layers',
  'engine.edit.references': 'References',
  'engine.edit.form': 'Form',
  'engine.edit.readOnly': 'Read-only (runtime overrides disabled).',
  'engine.edit.loading': 'Loading',
  'engine.edit.bespokeDesigner': 'Designer',
  'engine.edit.readOnlyHint':
    'Read-only — this metadata type does not allow runtime overrides. Edit the source in the package and redeploy.',
  'engine.edit.unsaved': 'Unsaved',
  'engine.edit.unsavedHint': 'You have unsaved changes.',
  'engine.edit.destructive': 'Destructive change',
  'engine.edit.destructiveHint':
    'The change would break existing references. Review the issues and confirm to force-save.',
  'engine.edit.forceSave': 'Force save',
  'engine.cancel': 'Cancel',
  'engine.quickfind.placeholder': "Find metadata types or items… (try 'view', 'account')",
  'engine.quickfind.empty': 'Type to search across all metadata types.',
  'engine.quickfind.title': 'Quick Find',
  'engine.quickfind.indexing': 'Indexing items across',
  'engine.quickfind.noMatches': 'No matches.',
  'engine.breadcrumb.allTypes': 'All Metadata Types',
};

const ENGINE_STRINGS_ZH: Record<string, string> = {
  'engine.directory.title': '元数据',
  'engine.directory.description':
    '平台协议共暴露 {count} 个元数据类型（其中 {writable} 个支持运行时覆盖）。点击任意卡片即可浏览、覆盖或创建实例。',
  'engine.directory.search': '搜索元数据类型…',
  'engine.directory.writableOnly': '仅显示可写',
  'engine.directory.quickFind': '快速查找',
  'engine.directory.noMatches': '没有匹配项',
  'engine.directory.noMatchesHint': '调整搜索或筛选条件以查看更多元数据类型。',
  'engine.directory.loading': '正在加载元数据类型…',
  'engine.directory.loadFailed': '加载元数据类型失败',
  'engine.directory.all': '全部',
  'engine.list.create': '新建',
  'engine.list.refresh': '刷新',
  'engine.list.search': '搜索名称、标签或描述…',
  'engine.list.empty': '暂无数据。',
  'engine.list.items': '条目',
  'engine.list.filtered': '已筛选',
  'engine.list.allSources': '全部来源',
  'engine.list.col.name': '名称',
  'engine.list.col.label': '标签',
  'engine.list.col.source': '来源',
  'engine.list.col.object': '对象',
  'engine.list.col.type': '类型',
  'engine.edit.save': '保存',
  'engine.edit.reset': '重置覆盖',
  'engine.edit.history': '历史',
  'engine.edit.layers': '层次',
  'engine.edit.references': '引用关系',
  'engine.edit.form': '表单',
  'engine.edit.readOnly': '只读（运行时覆盖未启用）。',
  'engine.edit.loading': '加载中',
  'engine.edit.bespokeDesigner': '可视化编辑器',
  'engine.edit.readOnlyHint':
    '只读 — 该元数据类型不支持运行时覆盖。请修改包内源代码并重新部署。',
  'engine.edit.unsaved': '未保存',
  'engine.edit.unsavedHint': '当前存在未保存的修改。',
  'engine.edit.destructive': '破坏性变更',
  'engine.edit.destructiveHint': '该修改会破坏现有引用关系。请检查问题清单后确认强制保存。',
  'engine.edit.forceSave': '强制保存',
  'engine.cancel': '取消',
  'engine.quickfind.placeholder': '搜索元数据类型或条目…（如：view、account）',
  'engine.quickfind.empty': '输入关键字以搜索所有元数据类型。',
  'engine.quickfind.title': '快速查找',
  'engine.quickfind.indexing': '正在索引所有类型，共',
  'engine.quickfind.noMatches': '没有匹配项。',
  'engine.breadcrumb.allTypes': '元数据',
};

function pickTable(
  locale: SupportedLocale | string | undefined,
): { types: Record<string, string>; domains: Record<string, string>; strings: Record<string, string> } {
  const lower = (locale ?? '').toLowerCase();
  if (lower.startsWith('zh')) {
    return { types: TYPE_LABELS_ZH, domains: DOMAIN_LABELS_ZH, strings: ENGINE_STRINGS_ZH };
  }
  return { types: TYPE_LABELS_EN, domains: DOMAIN_LABELS_EN, strings: ENGINE_STRINGS_EN };
}

export function translateMetadataType(
  type: string,
  locale?: SupportedLocale | string,
  fallback?: string,
): string {
  // Prefer locale table when the locale has a translation for this type.
  // This ensures Chinese labels win over the English `label` baked into
  // the server's metadata registry (which would otherwise show "Field"
  // even when the user's locale is zh-CN).
  const localized = pickTable(locale).types[type];
  if (localized) return localized;
  // Fall back to caller-supplied label (typically the server's English one).
  return fallback ?? type;
}

export function translateMetadataDomain(
  domain: string,
  locale?: SupportedLocale | string,
): string {
  return pickTable(locale).domains[domain] ?? domain;
}

export function t(key: string, locale?: SupportedLocale | string): string {
  return pickTable(locale).strings[key] ?? key;
}

/**
 * Format a translated string with `{token}` placeholders.
 *
 *   tFormat('engine.directory.description', 'zh-CN', { count: 28, writable: 4 })
 */
export function tFormat(
  key: string,
  locale: SupportedLocale | string | undefined,
  vars: Record<string, string | number>,
): string {
  const template = t(key, locale);
  return template.replace(/\{(\w+)\}/g, (_m, name) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Returns the locale string most browsers report (matches navigator.language). */
export function detectLocale(): SupportedLocale {
  if (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language)) return 'zh-CN';
  return 'en-US';
}

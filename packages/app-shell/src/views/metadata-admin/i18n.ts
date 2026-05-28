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
  job: 'Background Job',
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
  job: '后台任务',
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
  'engine.list.col.description': 'Description',
  'engine.list.emptyType': 'No {type} items registered',
  'engine.list.emptyQuery': 'No matches for "{query}"',
  'engine.list.createHint': 'Click "New" above to create the first {type}.',
  'engine.list.readOnlyHint':
    'This type is read-only — instances are defined by code artifacts in packages.',
  'engine.edit.save': 'Save',
  'engine.edit.reset': 'Reset overlay',
  'engine.edit.resetConfirm': 'Reset overlay for {type}/{name}?',
  'engine.edit.history': 'History',
  'engine.edit.layers': 'Layers',
  'engine.edit.references': 'References',
  'engine.edit.form': 'Form',
  'engine.edit.edit': 'Edit',
  'engine.edit.editOverlay': 'Edit overlay',
  'engine.edit.createNew': 'Create new',
  'engine.edit.detail': 'Detail',
  'engine.edit.preview': 'Preview',
  'engine.edit.designer': 'Designer',
  'engine.edit.related': 'Related',
  'engine.edit.overlay': 'overlay',
  'engine.edit.readOnlyBanner': 'Viewing in read-only mode. Click {edit} to make changes.',
  'engine.edit.readOnlyTypeBanner':
    'This type is read-only. To enable runtime editing, set {flag} to include {type}, or flip {override} in the registry.',
  'engine.repeater.empty': 'No items. Click + to add.',
  'engine.badge.writable': 'writable',
  'engine.badge.readOnly': 'read-only',
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
  // Permission matrix
  'perm.action.create': 'Create',
  'perm.action.read': 'Read',
  'perm.action.edit': 'Edit',
  'perm.action.delete': 'Delete',
  'perm.action.transfer': 'Transfer ownership',
  'perm.action.restore': 'Restore from trash',
  'perm.action.purge': 'Hard delete (purge)',
  'perm.action.viewAll': 'View All Records (bypass sharing)',
  'perm.action.modifyAll': 'Modify All Records (bypass sharing)',
  'perm.col.object': 'Object',
  'perm.col.bulk': 'Bulk',
  'perm.bulk.read': 'R',
  'perm.bulk.crud': 'CRUD',
  'perm.bulk.all': 'All',
  'perm.bulk.none': 'None',
  'perm.filter.placeholder': 'Filter objects…',
  'perm.filter.onlyGranted': 'Only granted',
  'perm.filter.empty': 'No objects match the filter.',
  'perm.field.name': 'Name',
  'perm.field.label': 'Label',
  'perm.field.isProfile': 'Is profile',
  'perm.field.loading': 'Loading fields…',
  'perm.field.empty': 'No fields registered for this object.',
  'perm.field.col.name': 'Field',
  'perm.field.read': 'Read',
  'perm.field.edit': 'Edit',
  'perm.stat.objects': 'Objects granted',
  'perm.stat.fields': 'Fields granted',
  'perm.stat.objectsGranted': 'Objects granted',
  'perm.stat.fieldOverrides': 'Field overrides',
  'perm.stat.objectsSuffix': 'objects',
  'perm.subtitle.profile': 'Profile',
  'perm.subtitle.set': 'Permission set',
  'perm.loading': 'Loading permission set {name}…',
  'perm.readOnly': 'Read-only (OS_METADATA_WRITABLE not enabled)',
  // Designer wrapper
  'designer.unsavedChanges': 'Unsaved changes',
  'designer.editingOverlay': 'Editing overlay',
  'designer.codeBaseline': 'Code baseline',
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
  'engine.list.col.description': '描述',
  'engine.list.emptyType': '暂无 {type} 条目',
  'engine.list.emptyQuery': '没有匹配 "{query}" 的结果',
  'engine.list.createHint': '点击上方"新建"创建第一个 {type}。',
  'engine.list.readOnlyHint': '此类型为只读 — 实例由包内的代码工件定义。',
  'engine.edit.save': '保存',
  'engine.edit.reset': '重置覆盖',
  'engine.edit.resetConfirm': '重置 {type}/{name} 的覆盖层？',
  'engine.edit.history': '历史',
  'engine.edit.layers': '层次',
  'engine.edit.references': '引用关系',
  'engine.edit.form': '表单',
  'engine.edit.edit': '编辑',
  'engine.edit.editOverlay': '编辑覆盖层',
  'engine.edit.createNew': '新建',
  'engine.edit.detail': '详情',
  'engine.edit.preview': '预览',
  'engine.edit.designer': '可视化编辑器',
  'engine.edit.related': '关联',
  'engine.edit.overlay': '覆盖',
  'engine.edit.readOnlyBanner': '当前为只读模式。点击 {edit} 进行修改。',
  'engine.edit.readOnlyTypeBanner':
    '此类型为只读。如需启用运行时编辑，请将 {flag} 设置为包含 {type}，或在注册表中开启 {override}。',
  'engine.repeater.empty': '暂无条目。点击 + 添加。',
  'engine.badge.writable': '可写',
  'engine.badge.readOnly': '只读',
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
  // Permission matrix
  'perm.action.create': '创建',
  'perm.action.read': '读取',
  'perm.action.edit': '编辑',
  'perm.action.delete': '删除',
  'perm.action.transfer': '转移所有者',
  'perm.action.restore': '从回收站恢复',
  'perm.action.purge': '彻底删除',
  'perm.action.viewAll': '查看所有记录（绕过共享规则）',
  'perm.action.modifyAll': '修改所有记录（绕过共享规则）',
  'perm.col.object': '对象',
  'perm.col.bulk': '批量',
  'perm.bulk.read': '读',
  'perm.bulk.crud': '增改删',
  'perm.bulk.all': '全选',
  'perm.bulk.none': '清空',
  'perm.filter.placeholder': '筛选对象…',
  'perm.filter.onlyGranted': '只看已授权',
  'perm.filter.empty': '没有匹配的对象。',
  'perm.field.name': '名称',
  'perm.field.label': '标签',
  'perm.field.isProfile': '作为 Profile',
  'perm.field.loading': '加载字段中…',
  'perm.field.empty': '该对象未注册字段。',
  'perm.field.col.name': '字段',
  'perm.field.read': '读',
  'perm.field.edit': '改',
  'perm.stat.objects': '已授权对象',
  'perm.stat.fields': '已授权字段',
  'perm.stat.objectsGranted': '已授权对象',
  'perm.stat.fieldOverrides': '字段覆盖',
  'perm.stat.objectsSuffix': '个对象',
  'perm.subtitle.profile': 'Profile',
  'perm.subtitle.set': '权限集',
  'perm.loading': '加载权限集 {name}…',
  'perm.readOnly': '只读（OS_METADATA_WRITABLE 未启用）',
  // Designer wrapper
  'designer.unsavedChanges': '未保存的修改',
  'designer.editingOverlay': '编辑覆盖层',
  'designer.codeBaseline': '代码基线',
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

/**
 * Mirror of `@objectstack/spec/system` SettingsManifest types.
 *
 * The UI repo doesn't depend on the server-side spec package, so we
 * duplicate the minimal subset needed by the renderer. Source of
 * truth lives in `framework/packages/spec/src/system/settings-manifest.zod.ts`
 * (ADR-0007).
 */

export type SpecifierType =
  | 'group'
  | 'child_pane'
  | 'info_banner'
  | 'title_value'
  | 'text'
  | 'textarea'
  | 'password'
  | 'email'
  | 'url'
  | 'phone'
  | 'number'
  | 'toggle'
  | 'select'
  | 'radio'
  | 'multiselect'
  | 'slider'
  | 'color'
  | 'json'
  | 'action_button';

export type SpecifierScope = 'tenant' | 'user';

export interface SpecifierOption {
  value: string | number | boolean;
  label: string | { defaultValue?: string; key?: string };
  icon?: string;
  description?: string;
}

export type SpecifierHandler =
  | { kind: 'http'; method?: string; url: string; body?: Record<string, unknown>; confirmText?: string }
  | { kind: 'action'; name: string; params?: Record<string, unknown>; confirmText?: string }
  | { kind: 'navigate'; url: string; target?: '_self' | '_blank' };

export interface Specifier {
  type: SpecifierType;
  id?: string;
  key?: string;
  label: string | { defaultValue?: string; key?: string };
  description?: string;
  icon?: string;
  default?: unknown;
  visible?: string;
  required?: boolean;
  encrypted?: boolean;
  scope?: SpecifierScope;
  deprecated?: boolean;
  replacedBy?: string;
  options?: SpecifierOption[];
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  rows?: number;
  handler?: SpecifierHandler;
  childNamespace?: string;
  bannerText?: string;
  bannerSeverity?: 'info' | 'success' | 'warning' | 'error';
}

export interface SettingsManifest {
  namespace: string;
  version: number;
  label: string | { defaultValue?: string; key?: string };
  icon?: string;
  description?: string;
  helpText?: string;
  scope?: SpecifierScope;
  readPermission?: string;
  writePermission?: string;
  category?: string;
  order?: number;
  specifiers: Specifier[];
  visible?: string;
  featureFlag?: string;
  beta?: boolean;
}

export interface ResolvedSettingValue<T = unknown> {
  value: T;
  source: 'env' | 'tenant' | 'user' | 'default';
  locked: boolean;
  lockedReason?: string;
}

export interface SettingsNamespacePayload {
  manifest: SettingsManifest;
  values: Record<string, ResolvedSettingValue>;
}

export interface SettingsActionResult {
  ok: boolean;
  message?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  details?: unknown;
}

export interface SettingsListResponse {
  manifests: SettingsManifest[];
}

/** Resolve i18n label objects to plain strings. */
export function resolveLabel(label: SettingsManifest['label'] | Specifier['label']): string {
  if (typeof label === 'string') return label;
  return label?.defaultValue || label?.key || '';
}

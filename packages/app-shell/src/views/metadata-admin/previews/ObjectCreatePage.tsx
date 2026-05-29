// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectCreatePage — lightweight "new object" wizard.
 *
 * Why a custom page?
 *   The generic SchemaForm flow for a Spec 7.1 `object` confronts the
 *   user with 20+ optional sections (fields, indexes, fieldGroups,
 *   hooks, validations, permissions, RLS, encryption, masking, …).
 *   That made sense when objects were authored as bare JSON; with the
 *   form-canvas designer landed (commit aedb37b), fields and most
 *   structural metadata get authored inline on the edit page.
 *
 * The create step should therefore collect only what the designer
 * cannot recover on its own:
 *   - `name`     — immutable identity; must be valid snake_case.
 *   - `label`    — singular display label (drives `name` via slug).
 *   - `pluralLabel` — optional; we suggest a naive English plural so
 *                     the user can accept-or-replace.
 *   - `description` — optional one-liner; pure documentation.
 *
 * After save we navigate straight to the edit page where the form
 * canvas + per-field inspector takes over. The saved object has
 * `fields: {}` and the canvas's empty state guides the user to drop
 * their first field.
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
} from '@object-ui/components';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { PageShell } from '../PageShell';
import { useMetadataClient, useMetadataTypes } from '../useMetadata';
import { detectLocale } from '../i18n';

interface Props {
  type: string;
}

export function ObjectCreatePage({ type }: Props) {
  const client = useMetadataClient();
  const navigate = useNavigate();
  const locale = React.useMemo(() => detectLocale(), []);
  const isZh = locale === 'zh-CN';
  const { entries } = useMetadataTypes(client);
  const entry = React.useMemo(
    () => entries.find((e) => e.type === type),
    [entries, type],
  );

  const [label, setLabel] = React.useState('');
  const [pluralLabel, setPluralLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [pluralTouched, setPluralTouched] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nameTaken, setNameTaken] = React.useState(false);

  const labelRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    labelRef.current?.focus();
  }, []);

  // Auto-derive `name` from `label` until the user edits it manually.
  React.useEffect(() => {
    if (!nameTouched) setName(toName(label));
  }, [label, nameTouched]);

  // Auto-suggest plural until user edits it manually.
  const suggestedPlural = label.trim() ? naivePlural(label.trim()) : '';
  const effectivePlural = pluralTouched ? pluralLabel : suggestedPlural;

  const nameValid = /^[a-z_][a-z0-9_]*$/.test(name);
  const labelValid = label.trim().length > 0;
  const canSubmit = labelValid && nameValid && !saving;

  // Probe name uniqueness on blur — cheap because object lists are small.
  async function probeName(candidate: string) {
    if (!candidate || !nameValid) {
      setNameTaken(false);
      return;
    }
    try {
      const list = await client.list<{ name: string }>(type);
      setNameTaken(list.some((it) => it?.name === candidate));
    } catch {
      // Network blip — let the server reject on save.
      setNameTaken(false);
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        label: label.trim(),
        fields: {},
      };
      if (effectivePlural.trim()) payload.pluralLabel = effectivePlural.trim();
      if (description.trim()) payload.description = description.trim();

      await client.save('object', name, payload, { mode: 'draft' });
      navigate(`../${encodeURIComponent(name)}`, { relative: 'path' });
    } catch (err: any) {
      const msg =
        err?.body?.error ??
        err?.body?.message ??
        err?.message ??
        (isZh ? '创建失败。' : 'Failed to create object.');
      setError(String(msg));
      setSaving(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <PageShell entry={entry ?? { type, label: type }} subtitle={isZh ? '新建对象' : 'New object'}>
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Hero card */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-start gap-4 p-6 border-b">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold leading-tight">
                {isZh ? '新建对象' : 'Create a new object'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isZh
                  ? '只需起个名字。字段后续在设计器里拖动添加。'
                  : 'Just give it a name. Fields are added later in the designer.'}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Label */}
            <Field
              htmlFor="obj-label"
              label={isZh ? '显示名称' : 'Display label'}
              required
              hint={isZh ? '例如：客户、订单、产品' : 'e.g. Account, Order, Product'}
            >
              <Input
                id="obj-label"
                ref={labelRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={isZh ? '例如：客户' : 'e.g. Account'}
                autoComplete="off"
              />
            </Field>

            {/* Plural */}
            <Field
              htmlFor="obj-plural"
              label={isZh ? '复数名称' : 'Plural label'}
              hint={
                !pluralTouched && suggestedPlural
                  ? isZh
                    ? `留空将使用 “${suggestedPlural}”`
                    : `Defaults to “${suggestedPlural}” if left blank`
                  : isZh
                    ? '用于列表与导航中的标题'
                    : 'Used in lists and navigation titles'
              }
            >
              <Input
                id="obj-plural"
                value={pluralTouched ? pluralLabel : suggestedPlural}
                onChange={(e) => {
                  setPluralTouched(true);
                  setPluralLabel(e.target.value);
                }}
                placeholder={isZh ? '例如：客户' : 'e.g. Accounts'}
                autoComplete="off"
                className={!pluralTouched && suggestedPlural ? 'text-muted-foreground' : ''}
                onFocus={() => {
                  if (!pluralTouched) {
                    setPluralTouched(true);
                    setPluralLabel(suggestedPlural);
                  }
                }}
              />
            </Field>

            {/* Name (API identifier) */}
            <Field
              htmlFor="obj-name"
              label={isZh ? 'API 名称' : 'API name'}
              required
              hint={
                <span className="inline-flex items-center gap-1.5">
                  <span>
                    {isZh
                      ? 'snake_case；创建后不可更改'
                      : 'snake_case; immutable after creation'}
                  </span>
                  {!nameTouched && name && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      {isZh ? '自动生成' : 'auto'}
                    </Badge>
                  )}
                  {!nameTouched && !name && label.trim() && (
                    <span className="text-amber-600 dark:text-amber-500">
                      {isZh
                        ? '— 显示名称含非英文字符，请手动填写'
                        : '— label has no ASCII letters, please enter manually'}
                    </span>
                  )}
                </span>
              }
              error={
                name && !nameValid
                  ? isZh
                    ? '只能包含小写字母、数字和下划线，且不能以数字开头。'
                    : 'Only lowercase letters, digits, and underscores; must not start with a digit.'
                  : nameTaken
                    ? isZh
                      ? '已存在同名对象。'
                      : 'An object with this name already exists.'
                    : null
              }
            >
              <Input
                id="obj-name"
                value={name}
                onChange={(e) => {
                  setNameTouched(true);
                  setName(e.target.value);
                  setNameTaken(false);
                }}
                onBlur={() => probeName(name)}
                placeholder="account"
                autoComplete="off"
                className="font-mono text-sm"
                spellCheck={false}
              />
            </Field>

            {/* Description */}
            <Field
              htmlFor="obj-desc"
              label={isZh ? '描述' : 'Description'}
              hint={isZh ? '可选；面向开发者的一句话说明' : 'Optional; one-line developer description'}
            >
              <Textarea
                id="obj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isZh
                    ? '例如：CRM 客户主档，承载销售机会与活动'
                    : 'e.g. CRM account record carrying opportunities and activities'
                }
                rows={2}
              />
            </Field>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('..', { relative: 'path' })}
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {isZh ? '返回' : 'Back'}
          </Button>

          <Button type="submit" disabled={!canSubmit || nameTaken}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {isZh ? '创建中…' : 'Creating…'}
              </>
            ) : (
              <>
                {isZh ? '创建并设计字段' : 'Create & design fields'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {isZh
            ? '创建后将进入字段设计器，所有其它设置（索引、权限、校验等）都可后续编辑。'
            : 'After creation you land in the field designer. All other settings (indexes, permissions, validations) can be added later.'}
        </p>
      </form>
    </PageShell>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

function Field({
  htmlFor,
  label,
  required,
  hint,
  error,
  children,
}: {
  htmlFor: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Slugify "Account Manager" → "account_manager". */
function toName(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1')
    .slice(0, 64);
}

/** Naive English pluralisation; user can always override. */
function naivePlural(s: string): string {
  if (!s) return s;
  // CJK / non-Latin scripts: plural form == singular (no inflection).
  if (!/[a-zA-Z]/.test(s)) return s;
  if (/(?:[sxz]|[cs]h)$/i.test(s)) return s + 'es';
  if (/[^aeiouAEIOU]y$/.test(s)) return s.slice(0, -1) + 'ies';
  return s + 's';
}

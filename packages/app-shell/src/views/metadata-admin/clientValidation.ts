// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Live client-side Zod validation for metadata drafts.
 *
 * Unblocked by `@objectstack/spec@7.x` — the spec package now ships
 * per-metadata-type Zod schemas under its kernel/data/ui/automation/
 * ai/system subpaths, so we no longer have to wait for the next save
 * round-trip to learn the draft is invalid.
 *
 * Usage (from ResourceEditPage):
 *
 *   const { issues } = await validateMetadataDraft(type, draft);
 *   setIssues(issues);
 *
 * Schemas are loaded lazily — the first call for a given type kicks
 * off a dynamic `import()` of the relevant spec subpath, then caches
 * the result. Types we don't have a client-side schema for (e.g.
 * `validation`, `role`, `workflow`, etc.) return an empty issue list;
 * the user still gets server-side diagnostics on save.
 */

import type { SchemaFormIssue } from './SchemaForm';

type ZodLikeSchema = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: Array<{ path: Array<string | number>; message: string }> };
  };
};

type SchemaLoader = () => Promise<ZodLikeSchema | undefined>;

// Map metadata-type name → loader for that type's root Zod schema.
// Each loader pulls only one spec subpath so we don't drag the whole
// 2MB schema bundle into the studio bundle.
//
// Types not listed (validation, role, workflow, trigger, approval,
// translation, profile, plus the 11 new 7.1 types like api/connector/
// webhook) fall back to server validation only.
const LOADERS: Record<string, SchemaLoader> = {
  object: async () => (await import('@objectstack/spec/data')).ObjectSchema as unknown as ZodLikeSchema,
  hook: async () => (await import('@objectstack/spec/data')).HookSchema as unknown as ZodLikeSchema,

  view: async () => (await import('@objectstack/spec/ui')).ViewSchema as unknown as ZodLikeSchema,
  page: async () => (await import('@objectstack/spec/ui')).PageSchema as unknown as ZodLikeSchema,
  app: async () => (await import('@objectstack/spec/ui')).AppSchema as unknown as ZodLikeSchema,
  dashboard: async () => (await import('@objectstack/spec/ui')).DashboardSchema as unknown as ZodLikeSchema,
  report: async () => (await import('@objectstack/spec/ui')).ReportSchema as unknown as ZodLikeSchema,
  action: async () => (await import('@objectstack/spec/ui')).ActionSchema as unknown as ZodLikeSchema,

  flow: async () => (await import('@objectstack/spec/automation')).FlowSchema as unknown as ZodLikeSchema,

  agent: async () => (await import('@objectstack/spec/ai')).AgentSchema as unknown as ZodLikeSchema,
  tool: async () => (await import('@objectstack/spec/ai')).ToolSchema as unknown as ZodLikeSchema,
  skill: async () => (await import('@objectstack/spec/ai')).SkillSchema as unknown as ZodLikeSchema,

  email_template: async () => (await import('@objectstack/spec/system')).EmailTemplateSchema as unknown as ZodLikeSchema,
  job: async () => (await import('@objectstack/spec/system')).JobSchema as unknown as ZodLikeSchema,

  permission: async () => (await import('@objectstack/spec/kernel')).PermissionSchema as unknown as ZodLikeSchema,
};

const SCHEMA_CACHE = new Map<string, ZodLikeSchema | null>();

async function getSchemaForType(type: string): Promise<ZodLikeSchema | null> {
  if (SCHEMA_CACHE.has(type)) return SCHEMA_CACHE.get(type) ?? null;
  const loader = LOADERS[type];
  if (!loader) {
    SCHEMA_CACHE.set(type, null);
    return null;
  }
  try {
    const schema = await loader();
    const value = (schema && typeof schema.safeParse === 'function') ? schema : null;
    SCHEMA_CACHE.set(type, value);
    return value;
  } catch {
    SCHEMA_CACHE.set(type, null);
    return null;
  }
}

/**
 * Returns true if a client-side schema exists for the given metadata
 * type. Useful for deciding whether to skip the debounce in caller.
 */
export function hasClientValidator(type: string): boolean {
  return type in LOADERS;
}

export interface ValidateResult {
  /** Whether a client schema was available and the draft conforms. */
  ok: boolean;
  /** Issues to render in SchemaForm + Monaco. Empty on success or unsupported type. */
  issues: SchemaFormIssue[];
}

/**
 * Run Zod validation for the given metadata draft. Returns `{ok: true,
 * issues: []}` for types without a registered schema so callers can
 * fall back to server-side diagnostics without special-casing.
 */
export async function validateMetadataDraft(
  type: string,
  draft: unknown,
): Promise<ValidateResult> {
  const schema = await getSchemaForType(type);
  if (!schema) return { ok: true, issues: [] };

  const result = schema.safeParse(draft);
  if (result.success) return { ok: true, issues: [] };

  const issues: SchemaFormIssue[] = (result.error?.issues ?? []).map((i) => ({
    path: (i.path ?? []).map((seg) => String(seg)).join('.'),
    message: i.message,
  }));
  return { ok: false, issues };
}

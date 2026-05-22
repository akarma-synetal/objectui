/**
 * PublicFormPage — public anonymous form host.
 *
 * Renders the `EmbeddableForm` component at a public URL outside of the
 * `ConsoleShell` / `AuthenticatedRoute` chain so unauthenticated visitors
 * can submit a record (e.g. CRM Web-to-Lead, Web-to-Case).
 *
 * The form spec is resolved from the framework `view` metadata by matching
 * `sharing.publicLink === "/forms/{slug}"`. Today's framework REST surface
 * doesn't yet ship a dedicated `GET /api/v1/forms/:slug` resolver, so this
 * page falls back to:
 *   1. Try `GET /api/v1/forms/:slug` (the future canonical endpoint)
 *   2. Fall back to listing `view` metadata and matching `publicLink` client-side
 *   3. Display a clear error state when no public form is found
 *
 * The submission posts to `POST /api/v1/forms/:slug/submit` (preferred) or
 * falls back to `POST /api/v1/data/{object}` (legacy). The framework's
 * `guest_portal` profile + `lead.hook`/`case.hook` server-side guards
 * (`isGuestSubmission = !ctx.user?.id`) keep the submission safe.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useObjectTranslation } from '@object-ui/i18n';
import { EmbeddableForm, type EmbeddableFormConfig, type EmbeddableFormTexts } from '@object-ui/plugin-form';
import type { DataSource } from '@object-ui/types';
import { LoadingScreen } from '@object-ui/app-shell';
import { Button } from '@object-ui/components';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

/**
 * Resolve a public form spec by slug. Tries the canonical endpoint first
 * and falls back to a client-side scan of the `view` metadata index.
 */
async function resolvePublicForm(slug: string): Promise<{ config: EmbeddableFormConfig; schema: any | null } | null> {
  const publicLink = `/forms/${slug}`;

  // 1. Canonical endpoint — when the backend implements it, this becomes
  //    a single round-trip with no auth header attached.
  try {
    const res = await fetch(`${SERVER_URL}/api/v1/forms/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const spec = await res.json();
      const config = mapViewSpecToEmbeddableConfig(spec, slug);
      if (!config) return null;
      return { config, schema: spec?.objectSchema ?? null };
    }
  } catch {
    // network error — fall through to the discovery fallback
  }

  // 2. Discovery fallback — list views, match by sharing.publicLink.
  //    Only views with sharing.allowAnonymous=true are eligible.
  try {
    const res = await fetch(`${SERVER_URL}/api/v1/meta/view`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const items: any[] = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
    const match = items.find((v) => {
      const formViews = v?.formViews ?? v?.form?.formViews ?? {};
      const candidate = Object.values<any>(formViews).find(
        (fv) => fv?.sharing?.allowAnonymous === true && fv?.sharing?.publicLink === publicLink,
      );
      if (candidate) {
        (v as any).__matchedFormView = candidate;
        return true;
      }
      const topLevel = v?.form;
      if (topLevel?.sharing?.allowAnonymous && topLevel?.sharing?.publicLink === publicLink) {
        (v as any).__matchedFormView = topLevel;
        return true;
      }
      return false;
    });
    if (!match) return null;
    const config = mapViewSpecToEmbeddableConfig(match, slug);
    if (!config) return null;
    return { config, schema: null };
  } catch {
    return null;
  }
}

/**
 * Translate a framework `FormView` spec into the `EmbeddableFormConfig`
 * shape consumed by `<EmbeddableForm>`.
 */
function mapViewSpecToEmbeddableConfig(
  spec: any,
  slug: string,
): EmbeddableFormConfig | null {
  const formView = spec?.__matchedFormView ?? spec?.form ?? spec;
  if (!formView) return null;
  const objectName =
    formView?.data?.object ??
    spec?.data?.object ??
    spec?.object ??
    spec?.objectName;
  if (!objectName) return null;

  // Flatten section fields into a flat field-name list — EmbeddableForm
  // falls back to the object's full schema when the list is empty, but a
  // public form should always be an explicit subset.
  const fields: string[] = [];
  for (const section of formView?.sections ?? []) {
    for (const f of section?.fields ?? []) {
      if (typeof f === 'string') fields.push(f);
      else if (f?.field) fields.push(f.field);
    }
  }

  return {
    formId: slug,
    objectName,
    title: spec?.label ?? formView?.label ?? `Public form: ${slug}`,
    description: formView?.description ?? spec?.description,
    fields: fields.length > 0 ? fields : undefined,
    allowMultiple: true,
    thankYouPage: {
      title: 'Thanks!',
      message: 'Your submission has been received. We will be in touch shortly.',
    },
  };
}

/**
 * Anonymous data source — posts to the public submit endpoint (preferred)
 * and falls back to the legacy data endpoint. No auth header is attached.
 * Only the `create` op is implemented; the embeddable form never reads.
 */
function createPublicDataSource(slug: string, schema: any | null): DataSource {
  const post = async (objectName: string, data: Record<string, unknown>) => {
    // 1. Preferred public endpoint
    const submitRes = await fetch(
      `${SERVER_URL}/api/v1/forms/${encodeURIComponent(slug)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    );
    if (submitRes.ok) return submitRes.json();

    // 2. Fallback — legacy create endpoint. Will only succeed when the
    //    framework's auth middleware attaches a `guest_portal` profile
    //    for unauthenticated requests AND the object's profile rules
    //    grant `allowCreate`.
    if (submitRes.status === 404) {
      const legacyRes = await fetch(
        `${SERVER_URL}/api/v1/data/${encodeURIComponent(objectName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!legacyRes.ok) {
        throw new Error(`Submission failed (${legacyRes.status}). Please try again.`);
      }
      return legacyRes.json();
    }
    throw new Error(`Submission failed (${submitRes.status}). Please try again.`);
  };

  // The EmbeddableForm only calls `.create(...)`. Stubs for the rest of
  // the DataSource interface keep TypeScript happy without giving guests
  // any read/edit/delete capability.
  return {
    create: post,
    update: () => Promise.reject(new Error('Not permitted on public form')),
    delete: () => Promise.reject(new Error('Not permitted on public form')),
    findOne: () => Promise.resolve(null),
    find: () => Promise.resolve({ data: [], total: 0 }),
    // EmbeddableForm calls getObjectSchema() to look up field types and
    // labels. The schema is embedded in the public-form resolver response
    // so no auth-protected meta call is required. Return a safe stub when
    // the backend didn't ship the schema (older builds / discovery path).
    getObjectSchema: async (name: string) => schema ?? { name, fields: {} },
  } as unknown as DataSource;
}

/**
 * No-op data source used by `?demo=1` so the success / thank-you flow can be
 * verified end-to-end in the browser without a running framework backend.
 */
function createDemoDataSource(): DataSource {
  return {
    create: async (_objectName: string, data: Record<string, unknown>) => {
      // eslint-disable-next-line no-console
      console.info('[PublicFormPage demo] would submit:', data);
      await new Promise((r) => setTimeout(r, 300));
      return { id: 'demo-' + Date.now(), ...data };
    },
    update: () => Promise.reject(new Error('Not permitted on public form')),
    delete: () => Promise.reject(new Error('Not permitted on public form')),
    findOne: () => Promise.resolve(null),
    find: () => Promise.resolve({ data: [], total: 0 }),
  } as unknown as DataSource;
}

export function PublicFormPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useObjectTranslation();
  const [config, setConfig] = useState<EmbeddableFormConfig | null>(null);
  const [schema, setSchema] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Localized UI chrome strings passed to <EmbeddableForm/>. Wrapped in a
  // memo so re-renders don't recreate the object on every keystroke.
  const texts: EmbeddableFormTexts = useMemo(
    () => ({
      submit: t('publicForm.submit'),
      submitting: t('publicForm.submitting'),
      submitAnother: t('publicForm.submitAnother'),
      poweredBy: t('publicForm.poweredBy'),
      secureNotice: t('publicForm.secureNotice'),
      thankYouTitle: t('publicForm.thankYouTitle'),
      thankYouMessage: t('publicForm.thankYouMessage'),
      redirecting: t('publicForm.redirecting', { seconds: '{{seconds}}' }),
    }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setConfig(null);
    setSchema(null);

    // Dev-only fallback: when no backend is reachable, the
    // `?demo=1` query param renders a hardcoded CRM web-to-lead form so
    // we can verify the UI without a running server.
    const params = new URLSearchParams(window.location.search);
    const demoMode = params.get('demo') === '1';

    if (demoMode) {
      setIsDemo(true);
      setConfig(buildDemoConfig(slug, t));
      setLoading(false);
      return;
    }
    setIsDemo(false);

    resolvePublicForm(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError(t('publicForm.unavailableDescription'));
        } else {
          setConfig(result.config);
          setSchema(result.schema);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('publicForm.unavailableDescription'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, t, reloadKey]);

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-muted/40 via-background to-background">
        <div className="max-w-md w-full bg-card border rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('publicForm.unavailableTitle')}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('publicForm.retry')}
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a href={`/console/f/${slug}?demo=1`}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {t('publicForm.tryDemo')}
              </a>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/70 pt-1">/console/f/{slug}</p>
        </div>
      </div>
    );
  }

  if (!config) return null;
  return (
    <EmbeddableForm
      config={{ ...config, texts: { ...texts, ...config.texts } }}
      dataSource={isDemo ? createDemoDataSource() : createPublicDataSource(slug, schema)}
    />
  );
}

/**
 * Hardcoded demo config that mirrors the CRM `web_to_lead` form view.
 * Used when the browser is launched without a live backend so the UI
 * can be verified in isolation. Strings are routed through i18n so the
 * demo localizes alongside the rest of the console.
 */
function buildDemoConfig(slug: string, t: (key: string) => string): EmbeddableFormConfig {
  if (slug === 'support' || slug === 'web-to-case') {
    return {
      formId: slug,
      objectName: 'case',
      title: t('publicForm.demo.supportTitle'),
      description: t('publicForm.demo.supportDescription'),
      customFields: [
        { name: 'subject',     label: t('publicForm.demo.field.subject'),     type: 'text',     required: true },
        { name: 'description', label: t('publicForm.demo.field.description'), type: 'textarea', required: true },
        { name: 'type',        label: t('publicForm.demo.field.issueType'),   type: 'select',
          options: [
            { label: t('publicForm.demo.issueType.question'),        value: 'question' },
            { label: t('publicForm.demo.issueType.problem'),         value: 'problem' },
            { label: t('publicForm.demo.issueType.bug'),             value: 'bug' },
            { label: t('publicForm.demo.issueType.feature_request'), value: 'feature_request' },
          ] },
        { name: 'priority',    label: t('publicForm.demo.field.priority'),    type: 'select',
          options: [
            { label: t('publicForm.demo.priority.low'),      value: 'low' },
            { label: t('publicForm.demo.priority.medium'),   value: 'medium' },
            { label: t('publicForm.demo.priority.high'),     value: 'high' },
            { label: t('publicForm.demo.priority.critical'), value: 'critical' },
          ] },
      ] as any,
      allowMultiple: true,
      thankYouPage: {
        title: t('publicForm.demo.thankYouSupportTitle'),
        message: t('publicForm.demo.thankYouSupportMessage'),
      },
    };
  }

  // Default: contact-us / web-to-lead
  return {
    formId: slug,
    objectName: 'lead',
    title: t('publicForm.demo.contactTitle'),
    description: t('publicForm.demo.contactDescription'),
    customFields: [
      { name: 'first_name', label: t('publicForm.demo.field.firstName'), type: 'text',  required: true },
      { name: 'last_name',  label: t('publicForm.demo.field.lastName'),  type: 'text',  required: true },
      { name: 'email',      label: t('publicForm.demo.field.email'),     type: 'email', required: true },
      { name: 'phone',      label: t('publicForm.demo.field.phone'),     type: 'text' },
      { name: 'title',      label: t('publicForm.demo.field.jobTitle'),  type: 'text' },
      { name: 'company',    label: t('publicForm.demo.field.company'),   type: 'text',  required: true },
      { name: 'website',    label: t('publicForm.demo.field.website'),   type: 'url' },
      { name: 'industry',   label: t('publicForm.demo.field.industry'),  type: 'select',
        options: [
          { label: t('publicForm.demo.industry.technology'), value: 'technology' },
          { label: t('publicForm.demo.industry.software'),   value: 'software' },
          { label: t('publicForm.demo.industry.finance'),    value: 'finance' },
          { label: t('publicForm.demo.industry.healthcare'), value: 'healthcare' },
          { label: t('publicForm.demo.industry.retail'),     value: 'retail' },
          { label: t('publicForm.demo.industry.other'),      value: 'other' },
        ] },
      { name: 'number_of_employees', label: t('publicForm.demo.field.companySize'), type: 'number' },
      { name: 'description', label: t('publicForm.demo.field.howCanWeHelp'), type: 'textarea', required: true },
    ] as any,
    allowMultiple: true,
    thankYouPage: {
      title: t('publicForm.demo.thankYouSalesTitle'),
      message: t('publicForm.demo.thankYouSalesMessage'),
    },
  };
}

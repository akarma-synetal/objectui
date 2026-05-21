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

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EmbeddableForm, type EmbeddableFormConfig } from '@object-ui/plugin-form';
import type { DataSource } from '@object-ui/types';
import { LoadingScreen } from '@object-ui/app-shell';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

/**
 * Resolve a public form spec by slug. Tries the canonical endpoint first
 * and falls back to a client-side scan of the `view` metadata index.
 */
async function resolvePublicForm(slug: string): Promise<EmbeddableFormConfig | null> {
  const publicLink = `/forms/${slug}`;

  // 1. Canonical endpoint — when the backend implements it, this becomes
  //    a single round-trip with no auth header attached.
  try {
    const res = await fetch(`${SERVER_URL}/api/v1/forms/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const spec = await res.json();
      return mapViewSpecToEmbeddableConfig(spec, slug);
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
    return mapViewSpecToEmbeddableConfig(match, slug);
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
function createPublicDataSource(slug: string): DataSource {
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
  const [config, setConfig] = useState<EmbeddableFormConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setConfig(null);

    // Dev-only fallback: when no backend is reachable, the
    // `?demo=1` query param renders a hardcoded CRM web-to-lead form so
    // we can verify the UI without a running server.
    const params = new URLSearchParams(window.location.search);
    const demoMode = params.get('demo') === '1';

    if (demoMode) {
      setIsDemo(true);
      setConfig(buildDemoConfig(slug));
      setLoading(false);
      return;
    }
    setIsDemo(false);

    resolvePublicForm(slug)
      .then((cfg) => {
        if (cancelled) return;
        if (!cfg) {
          setError(
            `No public form found at /forms/${slug}. Make sure the underlying ` +
            `view has sharing.allowAnonymous=true and matches this slug.`,
          );
        } else {
          setConfig(cfg);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load form');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">Form unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Try the demo: <a className="underline" href={`/f/${slug}?demo=1`}>/f/{slug}?demo=1</a>
          </p>
        </div>
      </div>
    );
  }

  if (!config) return null;
  return (
    <EmbeddableForm
      config={config}
      dataSource={isDemo ? createDemoDataSource() : createPublicDataSource(slug)}
    />
  );
}

/**
 * Hardcoded demo config that mirrors the CRM `web_to_lead` form view.
 * Used when the browser is launched without a live backend so the UI
 * can be verified in isolation.
 */
function buildDemoConfig(slug: string): EmbeddableFormConfig {
  if (slug === 'support' || slug === 'web-to-case') {
    return {
      formId: slug,
      objectName: 'case',
      title: 'Submit a Support Request',
      description: 'Tell us what is going wrong — our team responds within one business day.',
      customFields: [
        { name: 'subject',     label: 'Subject',     type: 'text',     required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
        { name: 'type',        label: 'Issue Type',  type: 'select',
          options: [
            { label: 'Question', value: 'question' },
            { label: 'Problem',  value: 'problem' },
            { label: 'Bug',      value: 'bug' },
            { label: 'Feature Request', value: 'feature_request' },
          ] },
        { name: 'priority',    label: 'Priority',    type: 'select',
          options: [
            { label: 'Low',      value: 'low' },
            { label: 'Medium',   value: 'medium' },
            { label: 'High',     value: 'high' },
            { label: 'Critical', value: 'critical' },
          ] },
      ] as any,
      allowMultiple: true,
      thankYouPage: {
        title: 'Got it!',
        message: 'A support engineer will follow up shortly. Save the page if you have more screenshots to add.',
      },
    };
  }

  // Default: contact-us / web-to-lead
  return {
    formId: slug,
    objectName: 'lead',
    title: 'Contact Us',
    description: 'Tell us about your project and a sales representative will get back to you within one business day.',
    customFields: [
      { name: 'first_name', label: 'First Name', type: 'text',  required: true },
      { name: 'last_name',  label: 'Last Name',  type: 'text',  required: true },
      { name: 'email',      label: 'Work Email', type: 'email', required: true },
      { name: 'phone',      label: 'Phone',      type: 'text' },
      { name: 'title',      label: 'Job Title',  type: 'text' },
      { name: 'company',    label: 'Company',    type: 'text',  required: true },
      { name: 'website',    label: 'Website',    type: 'url' },
      { name: 'industry',   label: 'Industry',   type: 'select',
        options: [
          { label: 'Technology',     value: 'technology' },
          { label: 'Software / SaaS', value: 'software' },
          { label: 'Finance',        value: 'finance' },
          { label: 'Healthcare',     value: 'healthcare' },
          { label: 'Retail',         value: 'retail' },
          { label: 'Other',          value: 'other' },
        ] },
      { name: 'number_of_employees', label: 'Company Size', type: 'number' },
      { name: 'description', label: 'How can we help?', type: 'textarea', required: true },
    ] as any,
    allowMultiple: true,
    thankYouPage: {
      title: 'Thanks!',
      message: 'We received your message. A sales representative will be in touch within one business day.',
    },
  };
}

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * EmbeddableForm Component
 *
 * A standalone embeddable form that can be accessed without authentication.
 * Designed for external data collection use cases (surveys, registrations, etc.).
 *
 * Features:
 * - Renders from ObjectFormSchema or inline field definitions
 * - No authentication required (public access)
 * - URL prefill parameters support (?name=John&email=...)
 * - Configurable branding (logo, colors, title)
 * - Success/thank-you page after submission
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DataSource, FormField } from '@object-ui/types';
import { Button } from '@object-ui/components';
import { CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { ObjectForm } from './ObjectForm';

export interface EmbeddableFormTexts {
  submit?: string;
  submitting?: string;
  submitAnother?: string;
  poweredBy?: string;
  secureNotice?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  /** Template string. `{{seconds}}` will be replaced with the remaining seconds. */
  redirecting?: string;
}

export interface EmbeddableFormConfig {
  /** Unique form ID */
  formId: string;
  /** Object name to create records in */
  objectName: string;
  /** Form title displayed at the top */
  title?: string;
  /** Form description / instructions */
  description?: string;
  /** Fields to include in the form (subset of object fields) */
  fields?: string[];
  /** Custom field definitions for inline forms */
  customFields?: FormField[];
  /** Branding configuration */
  branding?: {
    logo?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
  /** Thank you page configuration */
  thankYouPage?: {
    title?: string;
    message?: string;
    redirectUrl?: string;
    redirectDelay?: number;
  };
  /** Allow multiple submissions */
  allowMultiple?: boolean;
  /** Localized UI chrome strings (submit label, footer, thank-you defaults). */
  texts?: EmbeddableFormTexts;
}

export interface EmbeddableFormProps {
  /** Form configuration */
  config: EmbeddableFormConfig;
  /** Data source for creating records */
  dataSource?: DataSource;
  /** URL search parameters for prefilling fields */
  prefillParams?: Record<string, string>;
  /** Additional CSS class */
  className?: string;
}

/**
 * EmbeddableForm — Standalone form for external data collection.
 *
 * Can be rendered at a public URL (e.g., `/forms/:formId`) without auth.
 * Submissions create records in the specified object via DataSource.
 */
export const EmbeddableForm: React.FC<EmbeddableFormProps> = ({
  config,
  dataSource,
  prefillParams,
  className,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build initial data from URL prefill params or window.location.search
  const initialData = useMemo(() => {
    const data: Record<string, string> = {};
    // Explicit prefillParams take priority
    if (prefillParams) {
      for (const [key, value] of Object.entries(prefillParams)) {
        data[key] = value;
      }
    }
    // Also parse URL search parameters for prefilling (Phase 14 L2)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        if (!(key in data)) {
          data[key] = value;
        }
      });
    }
    return Object.keys(data).length > 0 ? data : undefined;
  }, [prefillParams]);

  const handleSubmit = useCallback(async (formData: Record<string, any>) => {
    setSubmitting(true);
    setError(null);

    try {
      if (dataSource) {
        await dataSource.create(config.objectName, formData);
      }
      setSubmitted(true);

      // Handle redirect after delay
      if (config.thankYouPage?.redirectUrl) {
        const delay = config.thankYouPage.redirectDelay ?? 3000;
        setTimeout(() => {
          window.location.href = config.thankYouPage!.redirectUrl!;
        }, delay);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [dataSource, config]);

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setError(null);
  }, []);

  // Branding styles
  const brandingStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (config.branding?.backgroundColor) {
      style.backgroundColor = config.branding.backgroundColor;
    }
    return style;
  }, [config.branding]);

  // Thank you page
  if (submitted) {
    const thankYou = config.thankYouPage;
    const texts = config.texts ?? {};
    const redirectSeconds = Math.ceil((thankYou?.redirectDelay ?? 3000) / 1000);
    const redirectingText = (texts.redirecting ?? 'Redirecting in {{seconds}} seconds…').replace(
      '{{seconds}}',
      String(redirectSeconds),
    );
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-muted/40 via-background to-background ${className || ''}`}
        style={brandingStyle}
      >
        <div className="max-w-md w-full bg-card border rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {thankYou?.title || texts.thankYouTitle || 'Thank You!'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {thankYou?.message || texts.thankYouMessage || 'Your submission has been received successfully.'}
          </p>
          {config.allowMultiple && (
            <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">
              {texts.submitAnother ?? 'Submit Another Response'}
            </Button>
          )}
          {thankYou?.redirectUrl && (
            <p className="text-xs text-muted-foreground">{redirectingText}</p>
          )}
        </div>
      </div>
    );
  }

  const texts = config.texts ?? {};
  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-muted/40 via-background to-background ${className || ''}`}
      style={brandingStyle}
    >
      <div className="max-w-2xl w-full bg-card border rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div
          className="px-6 sm:px-8 pt-7 pb-5 border-b bg-muted/20"
          style={config.branding?.primaryColor ? { borderBottomColor: config.branding.primaryColor } : undefined}
        >
          {config.branding?.logo && (
            <img src={config.branding.logo} alt="Logo" className="h-8 mb-4" />
          )}
          {config.title && (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {config.title}
            </h1>
          )}
          {config.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {config.description}
            </p>
          )}
        </div>

        {/* Form body */}
        <div className="px-6 sm:px-8 py-6">
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <ObjectForm
            schema={{
              type: 'object-form',
              objectName: config.objectName,
              mode: 'create',
              fields: config.fields,
              customFields: config.customFields,
              initialData,
              onSuccess: handleSubmit,
              submitLabel: submitting
                ? texts.submitting ?? 'Submitting...'
                : texts.submit ?? 'Submit',
            }}
            dataSource={dataSource}
          />
          {submitting && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>{texts.submitting ?? 'Submitting…'}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>
              {texts.secureNotice ??
                'Your information is transmitted securely and only used to respond to your request.'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground/80">
            {texts.poweredBy ?? 'Powered by ObjectStack'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmbeddableForm;

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { useAuth } from './useAuth';
import type { AuthLinkComponentProps } from './types';
import {
  AUTH_FIELD_LABEL_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthErrorBanner,
  AuthFormHeader,
  AuthMailIcon,
  AuthSpinner,
} from './authStyles';

/** Translatable labels for the ForgotPasswordForm */
export interface ForgotPasswordFormLabels {
  emailLabel?: string;
  emailPlaceholder?: string;
  submitButton?: string;
  submittingButton?: string;
  successTitle?: string;
  successDescription?: string;
  backToSignInText?: string;
  rememberPasswordText?: string;
  signInText?: string;
}

export interface ForgotPasswordFormProps {
  /** Callback on successful submission */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Link to login page */
  loginUrl?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom icon shown above the title (defaults to a small key disc) */
  icon?: React.ReactNode;
  /** Custom link component for SPA navigation (e.g. React Router's Link) */
  linkComponent?: React.ComponentType<AuthLinkComponentProps>;
  /** Override default labels for i18n */
  labels?: ForgotPasswordFormLabels;
  /** Hide the icon disc above the form title. Defaults to false. */
  hideIcon?: boolean;
}

const DefaultLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <a href={href} className={className}>{children}</a>
);

const DefaultKeyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
    aria-hidden="true"
  >
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

/**
 * Forgot password form component.
 * Sends a password reset email to the user. Drop inside an `AuthShell`
 * for a polished split-screen experience.
 *
 * @example
 * ```tsx
 * <ForgotPasswordForm
 *   onSuccess={() => setShowSuccess(true)}
 *   loginUrl="/login"
 * />
 * ```
 */
export function ForgotPasswordForm({
  onSuccess,
  onError,
  loginUrl = '/login',
  title = 'Reset your password',
  description = "Enter your email address and we'll send you a link to reset your password",
  icon,
  hideIcon = false,
  linkComponent: LinkComp = DefaultLink,
  labels = {},
}: ForgotPasswordFormProps) {
  const { forgotPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const l = {
    emailLabel: labels.emailLabel ?? 'Email',
    emailPlaceholder: labels.emailPlaceholder ?? 'name@example.com',
    submitButton: labels.submitButton ?? 'Send Reset Link',
    submittingButton: labels.submittingButton ?? 'Sending...',
    successTitle: labels.successTitle ?? 'Check your email',
    successDescription:
      labels.successDescription ??
      "We've sent a password reset link to {{email}}. Please check your inbox.",
    backToSignInText: labels.backToSignInText ?? 'Back to sign in',
    rememberPasswordText: labels.rememberPasswordText ?? 'Remember your password?',
    signInText: labels.signInText ?? 'Sign in',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await forgotPassword(email);
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      setError(authError.message);
      onError?.(authError);
    }
  };

  if (submitted) {
    const successMsg = l.successDescription.includes('{{email}}')
      ? l.successDescription.replace('{{email}}', email)
      : `${l.successDescription} ${email}`;
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-7 sm:w-[400px]">
        <AuthFormHeader
          icon={
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400">
              <AuthMailIcon />
            </span>
          }
          title={l.successTitle}
          description={successMsg}
        />
        {loginUrl && (
          <p className="text-center text-sm text-muted-foreground">
            <LinkComp href={loginUrl} className={AUTH_LINK_CLASS}>
              ← {l.backToSignInText}
            </LinkComp>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-7 sm:w-[400px]">
      <AuthFormHeader
        icon={hideIcon ? undefined : (icon ?? <DefaultKeyIcon />)}
        title={title}
        description={description}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthErrorBanner message={error} />}

        <div className="space-y-2">
          <label htmlFor="forgot-email" className={AUTH_FIELD_LABEL_CLASS}>
            {l.emailLabel}
          </label>
          <input
            id="forgot-email"
            type="email"
            placeholder={l.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <button type="submit" disabled={isLoading} className={AUTH_PRIMARY_BUTTON_CLASS}>
          {isLoading && <AuthSpinner />}
          {isLoading ? l.submittingButton : l.submitButton}
        </button>
      </form>

      {loginUrl && (
        <p className="px-8 text-center text-sm text-muted-foreground">
          {l.rememberPasswordText}{' '}
          <LinkComp href={loginUrl} className={AUTH_LINK_CLASS}>
            {l.signInText}
          </LinkComp>
        </p>
      )}
    </div>
  );
}

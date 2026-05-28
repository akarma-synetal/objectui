/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { useAuth } from './useAuth';
import { SocialSignInButtons } from './SocialSignInButtons';
import type { AuthLinkComponentProps } from './types';
import {
  AUTH_FIELD_LABEL_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthDivider,
  AuthErrorBanner,
  AuthFormHeader,
  AuthSpinner,
} from './authStyles';

/** Translatable labels for the RegisterForm */
export interface RegisterFormLabels {
  nameLabel?: string;
  namePlaceholder?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  confirmPasswordLabel?: string;
  confirmPasswordPlaceholder?: string;
  passwordMismatchError?: string;
  passwordTooShortError?: string;
  submitButton?: string;
  submittingButton?: string;
  hasAccountText?: string;
  signInText?: string;
  /** Divider label between social sign-up and email/password (defaults to "or") */
  orText?: string;
}

export interface RegisterFormProps {
  /** Callback on successful registration AND auto sign-in. Not called when the
   *  server requires email verification — use `onVerificationRequired` for that. */
  onSuccess?: () => void;
  /** Callback when the server accepted the registration but is gating
   *  sign-in on email verification. The page should swap the form for a
   *  "check your inbox" confirmation. */
  onVerificationRequired?: (email: string) => void;
  /** Callback on registration error */
  onError?: (error: Error) => void;
  /** Link to login page */
  loginUrl?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom icon shown above the title (defaults to a small user-plus disc) */
  icon?: React.ReactNode;
  /** Custom link component for SPA navigation (e.g. React Router's Link) */
  linkComponent?: React.ComponentType<AuthLinkComponentProps>;
  /** Override default labels for i18n */
  labels?: RegisterFormLabels;
  /** Hide the icon disc above the form title. Defaults to false. */
  hideIcon?: boolean;
}

const DefaultLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <a href={href} className={className}>{children}</a>
);

const DefaultUserPlusIcon = () => (
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
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

/**
 * Registration form component with name, email, and password fields.
 * Uses Tailwind CSS utility classes for styling. Drop inside an `AuthShell`
 * for a polished split-screen experience.
 *
 * @example
 * ```tsx
 * <RegisterForm
 *   onSuccess={() => navigate('/dashboard')}
 *   loginUrl="/login"
 * />
 * ```
 */
export function RegisterForm({
  onSuccess,
  onVerificationRequired,
  onError,
  loginUrl = '/login',
  title = 'Create an account',
  description = 'Enter your information to get started',
  icon,
  hideIcon = false,
  linkComponent: LinkComp = DefaultLink,
  labels = {},
}: RegisterFormProps) {
  const { signUp, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasSocialProviders, setHasSocialProviders] = useState(false);

  const l = {
    nameLabel: labels.nameLabel ?? 'Name',
    namePlaceholder: labels.namePlaceholder ?? 'John Doe',
    emailLabel: labels.emailLabel ?? 'Email',
    emailPlaceholder: labels.emailPlaceholder ?? 'name@example.com',
    passwordLabel: labels.passwordLabel ?? 'Password',
    passwordPlaceholder: labels.passwordPlaceholder ?? 'Create a password (min. 8 characters)',
    confirmPasswordLabel: labels.confirmPasswordLabel ?? 'Confirm Password',
    confirmPasswordPlaceholder: labels.confirmPasswordPlaceholder ?? 'Confirm your password',
    passwordMismatchError: labels.passwordMismatchError ?? 'Passwords do not match',
    passwordTooShortError: labels.passwordTooShortError ?? 'Password must be at least 8 characters',
    submitButton: labels.submitButton ?? 'Create Account',
    submittingButton: labels.submittingButton ?? 'Creating account…',
    hasAccountText: labels.hasAccountText ?? 'Already have an account?',
    signInText: labels.signInText ?? 'Sign in',
    orText: labels.orText ?? 'or',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(l.passwordMismatchError);
      return;
    }

    if (password.length < 8) {
      setError(l.passwordTooShortError);
      return;
    }

    try {
      const result = await signUp(name, email, password);
      if (result?.requiresVerification) {
        onVerificationRequired?.(email);
        return;
      }
      onSuccess?.();
    } catch (err) {
      const authError = err instanceof Error ? err : new Error(String(err));
      setError(authError.message);
      onError?.(authError);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-7 sm:w-[400px]">
      <AuthFormHeader
        icon={hideIcon ? undefined : (icon ?? <DefaultUserPlusIcon />)}
        title={title}
        description={description}
      />

      <div className="space-y-5">
        <SocialSignInButtons mode="sign-up" onProvidersResolved={(has) => setHasSocialProviders(has)} />

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasSocialProviders && <AuthDivider label={l.orText} />}

          {error && <AuthErrorBanner message={error} />}

          <div className="space-y-2">
            <label htmlFor="register-name" className={AUTH_FIELD_LABEL_CLASS}>
              {l.nameLabel}
            </label>
            <input
              id="register-name"
              type="text"
              placeholder={l.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              disabled={isLoading}
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-email" className={AUTH_FIELD_LABEL_CLASS}>
              {l.emailLabel}
            </label>
            <input
              id="register-email"
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

          <div className="space-y-2">
            <label htmlFor="register-password" className={AUTH_FIELD_LABEL_CLASS}>
              {l.passwordLabel}
            </label>
            <input
              id="register-password"
              type="password"
              placeholder={l.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isLoading}
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-confirm-password" className={AUTH_FIELD_LABEL_CLASS}>
              {l.confirmPasswordLabel}
            </label>
            <input
              id="register-confirm-password"
              type="password"
              placeholder={l.confirmPasswordPlaceholder}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isLoading}
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {isLoading && <AuthSpinner />}
            {isLoading ? l.submittingButton : l.submitButton}
          </button>
        </form>
      </div>

      {loginUrl && (
        <p className="px-8 text-center text-sm text-muted-foreground">
          {l.hasAccountText}{' '}
          <LinkComp href={loginUrl} className={AUTH_LINK_CLASS}>
            {l.signInText}
          </LinkComp>
        </p>
      )}
    </div>
  );
}

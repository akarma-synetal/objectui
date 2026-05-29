/**
 * VerifyEmailPage — Console-hosted email-verification landing page.
 *
 * Ported from `framework/apps/account/src/routes/verify-email.tsx`. The
 * user hits this URL after clicking the link in the verification email:
 * `?token=…` is consumed on mount via `POST /api/v1/auth/verify-email`
 * (better-auth's standard endpoint). `useAuth()` doesn't expose a
 * `verifyEmail()` so we call the REST endpoint directly.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@object-ui/components';
import { AuthLayout } from './AuthLayout';

const AUTH_BASE = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

export function VerifyEmailPage() {
  const { t } = useObjectTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(
        t('auth.verifyEmail.missingToken', {
          defaultValue: 'Verification link is missing a token.',
        }),
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // better-auth exposes verify-email as a GET with `?token=` *or* a
        // POST with `{ token }` body. The GET variant 302-redirects on
        // success; the POST variant returns JSON. We use POST so the SPA
        // controls the post-verify UX.
        const res = await fetch(`${AUTH_BASE}/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string })?.message ||
              `Verification failed: ${res.status}`,
          );
        }
        if (!cancelled) setStatus('success');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(
            (err as Error).message ||
              t('auth.verifyEmail.errorDescription', {
                defaultValue: 'Verification failed. Please request a new link.',
              }),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <AuthLayout>
      <Card className="border-border/60 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        {status === 'loading' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl tracking-tight">
                {t('auth.verifyEmail.verifyingTitle', { defaultValue: 'Verifying…' })}
              </CardTitle>
              <CardDescription>
                {t('auth.verifyEmail.verifyingDescription', {
                  defaultValue: 'Hang tight while we confirm your email.',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </CardContent>
          </>
        )}
        {status === 'success' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="size-6" />
              </div>
              <CardTitle className="text-xl tracking-tight">
                {t('auth.verifyEmail.successTitle', { defaultValue: 'Email verified' })}
              </CardTitle>
              <CardDescription>
                {t('auth.verifyEmail.successDescription', {
                  defaultValue: 'Your email is confirmed. You can now sign in.',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('auth.verifyEmail.signInLink', { defaultValue: 'Go to sign in' })}
              </Link>
            </CardContent>
          </>
        )}
        {status === 'error' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
                <XCircle className="size-6" />
              </div>
              <CardTitle className="text-xl tracking-tight">
                {t('auth.verifyEmail.errorTitle', { defaultValue: 'Verification failed' })}
              </CardTitle>
              <CardDescription>
                {message ||
                  t('auth.verifyEmail.errorDescription', {
                    defaultValue: 'Verification failed. Please request a new link.',
                  })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('auth.verifyEmail.backToSignIn', { defaultValue: 'Back to sign in' })}
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}

export default VerifyEmailPage;

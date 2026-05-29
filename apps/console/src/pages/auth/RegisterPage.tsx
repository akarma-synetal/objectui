/**
 * RegisterPage — Console-hosted sign-up surface.
 *
 * Ported from `framework/apps/account/src/routes/register.tsx`. Wraps
 * `<RegisterForm>` from `@object-ui/auth` and layers Console-specific
 * concerns:
 *
 *  - Bounces to `/login` if `emailPassword.disableSignUp === true`
 *    (defense-in-depth; the server-side gate is the source of truth).
 *  - Routes to `/verify-email-prompt` when the server requires email
 *    verification before sign-in.
 *  - Replays an `/oauth2/authorize` query string when the user landed
 *    here mid-SSO so the IdP can continue the flow post-signup.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, RegisterForm } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { AuthLayout } from './AuthLayout';

function isSafeRedirect(target: string | null): target is string {
  return !!target && target.startsWith('/') && !target.startsWith('//');
}

function RouterLink(props: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link to={props.href} className={props.className}>
      {props.children}
    </Link>
  );
}

export function RegisterPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const {
    user,
    isLoading,
    organizations,
    isOrganizationsLoading,
    activeOrganization,
    switchOrganization,
    getAuthConfig,
  } = useAuth();

  const [signUpDisabled, setSignUpDisabled] = useState<boolean | null>(null);
  const [autoSelectingOrg, setAutoSelectingOrg] = useState(false);

  // Probe public auth config — bounce to /login if sign-up is gated off.
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        const disabled = cfg?.emailPassword?.disableSignUp === true;
        setSignUpDisabled(disabled);
        if (disabled) {
          const search = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
          navigate(`/login${search}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setSignUpDisabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig, navigate, redirect]);

  // Post-signup orchestration mirrors LoginPage exactly.
  useEffect(() => {
    if (!user) return;

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has('client_id') && sp.has('redirect_uri')) {
        window.location.assign(`/api/v1/auth/oauth2/authorize${window.location.search}`);
        return;
      }
    }

    if (!activeOrganization) {
      if (isOrganizationsLoading || autoSelectingOrg) return;
      if (organizations.length === 1) {
        setAutoSelectingOrg(true);
        switchOrganization(organizations[0].id)
          .catch(() => undefined)
          .finally(() => setAutoSelectingOrg(false));
        return;
      }
      if (organizations.length === 0) {
        window.location.assign(isSafeRedirect(redirect) ? redirect : '/');
        return;
      }
      window.location.assign('/organizations');
      return;
    }

    if (autoSelectingOrg) return;
    window.location.assign(isSafeRedirect(redirect) ? redirect : '/');
  }, [
    user,
    activeOrganization,
    organizations,
    isOrganizationsLoading,
    autoSelectingOrg,
    redirect,
    switchOrganization,
  ]);

  if (signUpDisabled === null || isLoading || user) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </AuthLayout>
    );
  }

  const loginUrl = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';

  return (
    <AuthLayout>
      <RegisterForm
        title={t('auth.register.title', { defaultValue: 'Create your account' })}
        description={t('auth.register.description', {
          defaultValue: 'Sign up to get started',
        })}
        loginUrl={loginUrl}
        linkComponent={RouterLink}
        onVerificationRequired={(email) => {
          const sp = new URLSearchParams();
          sp.set('email', email);
          if (redirect) sp.set('redirect', redirect);
          navigate(`/verify-email-prompt?${sp.toString()}`, { replace: true });
        }}
        labels={{
          nameLabel: t('auth.register.nameLabel', { defaultValue: 'Name' }),
          emailLabel: t('auth.emailLabel', { defaultValue: 'Email' }),
          emailPlaceholder: t('auth.emailPlaceholder', { defaultValue: 'name@example.com' }),
          passwordLabel: t('auth.passwordLabel', { defaultValue: 'Password' }),
          confirmPasswordLabel: t('auth.register.confirmPassword', {
            defaultValue: 'Confirm password',
          }),
          submitButton: t('auth.register.submit', { defaultValue: 'Create account' }),
          submittingButton: t('auth.register.submitting', { defaultValue: 'Creating account…' }),
          hasAccountText: t('auth.register.hasAccount', { defaultValue: 'Already have an account?' }),
          signInText: t('auth.register.signIn', { defaultValue: 'Sign in' }),
        }}
      />
    </AuthLayout>
  );
}

export default RegisterPage;

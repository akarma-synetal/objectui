/**
 * Register Page for ObjectStack Console
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RegisterForm, useAuth, type AuthLinkComponentProps } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { AuthPageLayout } from './AuthPageLayout';

const RouterLink = ({ href, className, children }: AuthLinkComponentProps) => (
  <Link to={href} className={className}>{children}</Link>
);

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { getAuthConfig } = useAuth();

  // Defense-in-depth: even if a user lands on /register directly when
  // signup is disabled, bounce them to /login. The server-side
  // `disableSignUp` (set by env `OS_DISABLE_SIGNUP=true` or the
  // `emailAndPassword.disableSignUp` config option) will still 403 any
  // submission, but redirecting here avoids a confusing form.
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then(cfg => {
        if (cancelled) return;
        if (cfg?.emailPassword?.disableSignUp === true) {
          navigate('/login', { replace: true });
        } else {
          setAllowed(true);
        }
      })
      .catch(() => { if (!cancelled) setAllowed(true); });
    return () => { cancelled = true; };
  }, [getAuthConfig, navigate]);

  if (allowed !== true) {
    // Render nothing until we know the flag — prevents a flash of the form.
    return <AuthPageLayout>{null}</AuthPageLayout>;
  }

  return (
    <AuthPageLayout>
      <RegisterForm
        onSuccess={() => navigate('/')}
        loginUrl="/login"
        title={t('auth.register.title')}
        description={t('auth.register.description')}
        linkComponent={RouterLink}
        labels={{
          nameLabel: t('auth.register.nameLabel'),
          namePlaceholder: t('auth.register.namePlaceholder'),
          emailLabel: t('auth.register.emailLabel'),
          emailPlaceholder: t('auth.register.emailPlaceholder'),
          passwordLabel: t('auth.register.passwordLabel'),
          passwordPlaceholder: t('auth.register.passwordPlaceholder'),
          confirmPasswordLabel: t('auth.register.confirmPasswordLabel'),
          confirmPasswordPlaceholder: t('auth.register.confirmPasswordPlaceholder'),
          passwordMismatchError: t('auth.register.passwordMismatchError'),
          passwordTooShortError: t('auth.register.passwordTooShortError'),
          submitButton: t('auth.register.submitButton'),
          submittingButton: t('auth.register.submittingButton'),
          hasAccountText: t('auth.register.hasAccountText'),
          signInText: t('auth.register.signInText'),
        }}
      />
    </AuthPageLayout>
  );
}

/**
 * ForgotPasswordPage — Console-hosted "send me a reset link" surface.
 *
 * Ported from `framework/apps/account/src/routes/forgot-password.tsx`.
 * Uses `@object-ui/auth`'s `ForgotPasswordForm` for the email input and
 * server call so the UX matches LoginForm / RegisterForm exactly.
 */

import { Link } from 'react-router-dom';
import { ForgotPasswordForm } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { AuthLayout } from './AuthLayout';

function RouterLink(props: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link to={props.href} className={props.className}>
      {props.children}
    </Link>
  );
}

export function ForgotPasswordPage() {
  const { t } = useObjectTranslation();

  return (
    <AuthLayout>
      <ForgotPasswordForm
        loginUrl="/login"
        linkComponent={RouterLink}
        title={t('auth.forgotPassword.title', { defaultValue: 'Reset your password' })}
        description={t('auth.forgotPassword.description', {
          defaultValue: "Enter your email and we'll send you a reset link.",
        })}
        labels={{
          emailLabel: t('auth.emailLabel', { defaultValue: 'Email' }),
          emailPlaceholder: t('auth.emailPlaceholder', { defaultValue: 'name@example.com' }),
          submitButton: t('auth.forgotPassword.submit', { defaultValue: 'Send reset link' }),
          submittingButton: t('auth.forgotPassword.submitting', {
            defaultValue: 'Sending…',
          }),
          successTitle: t('auth.forgotPassword.checkEmailTitle', {
            defaultValue: 'Check your email',
          }),
          successDescription: t('auth.forgotPassword.checkEmailDescription', {
            defaultValue: 'If an account exists, a reset link has been sent.',
          }),
          backToSignInText: t('auth.forgotPassword.backToSignIn', {
            defaultValue: 'Back to sign in',
          }),
          rememberPasswordText: t('auth.forgotPassword.rememberPassword', {
            defaultValue: 'Remember your password?',
          }),
          signInText: t('auth.forgotPassword.signIn', { defaultValue: 'Sign in' }),
        }}
      />
    </AuthLayout>
  );
}

export default ForgotPasswordPage;


/**
 * VerifyEmailPromptPage — "we sent you a link" page shown after sign-up
 * or after a sign-in attempt was blocked by `EMAIL_NOT_VERIFIED`.
 *
 * Ported from `framework/apps/account/src/routes/verify-email-prompt.tsx`.
 * Calls `useAuth().sendVerificationEmail(email, callbackURL)` on resend.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@object-ui/components';
import { AuthLayout } from './AuthLayout';

export function VerifyEmailPromptPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const redirect = params.get('redirect') ?? '';
  const { sendVerificationEmail } = useAuth();

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error(
        t('auth.verifyEmail.resendFailed', {
          defaultValue: 'Cannot resend verification email',
        }),
        {
          description: t('auth.verifyEmail.emailMissing', {
            defaultValue: 'Email address is missing',
          }),
        },
      );
      return;
    }

    setResending(true);
    try {
      await sendVerificationEmail(email, redirect || '/');
      setResent(true);
      toast.success(
        t('auth.verifyEmail.resentSuccess', {
          defaultValue: 'Verification email sent!',
        }),
        {
          description: t('auth.verifyEmail.resentDescription', {
            defaultValue: 'Please check your inbox and click the verification link.',
          }),
        },
      );
    } catch (err) {
      toast.error(
        t('auth.verifyEmail.resendFailed', {
          defaultValue: 'Failed to resend verification email',
        }),
        { description: (err as Error).message },
      );
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    const search = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
    navigate(`/login${search}`);
  };

  return (
    <AuthLayout>
      <Card className="border-border/60 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-8 text-primary" />
          </div>
          <CardTitle className="text-xl tracking-tight">
            {t('auth.verifyEmail.title', { defaultValue: 'Verify your email address' })}
          </CardTitle>
          <CardDescription>
            {t('auth.verifyEmail.description', {
              defaultValue:
                'We sent a verification link to your email address. Please click the link to verify your account.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {email ? (
              <p className="text-center text-sm text-muted-foreground">
                {t('auth.verifyEmail.sentTo', { defaultValue: 'Sent to:' })}{' '}
                <span className="font-medium text-foreground">{email}</span>
              </p>
            ) : null}

            <Button
              onClick={handleResend}
              disabled={resending || resent}
              className="w-full"
              variant={resent ? 'outline' : 'default'}
            >
              {resending ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  {t('auth.verifyEmail.resending', { defaultValue: 'Sending…' })}
                </>
              ) : resent ? (
                t('auth.verifyEmail.resent', {
                  defaultValue: 'Email sent! Check your inbox',
                })
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  {t('auth.verifyEmail.resendButton', {
                    defaultValue: 'Resend verification email',
                  })}
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t('auth.verifyEmail.or', { defaultValue: 'Or' })}
                </span>
              </div>
            </div>

            <Button onClick={handleBackToLogin} variant="ghost" className="w-full">
              {t('auth.verifyEmail.backToLogin', { defaultValue: 'Back to login' })}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t('auth.verifyEmail.checkSpam', {
                defaultValue:
                  "Didn't receive the email? Check your spam folder or contact support.",
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default VerifyEmailPromptPage;

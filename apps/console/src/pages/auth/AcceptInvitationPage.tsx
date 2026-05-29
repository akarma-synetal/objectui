/**
 * AcceptInvitationPage — /accept-invitation/:invitationId surface.
 *
 * Ported from `framework/apps/account/src/routes/accept-invitation.$invitationId.tsx`.
 *
 * Anonymous users get bounced to /login with `?redirect=` so they come
 * back here once signed in. Authenticated users get an accept/decline
 * prompt; both actions hit `useAuth()` and land on /organizations.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export function AcceptInvitationPage() {
  const { t } = useObjectTranslation();
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const {
    user,
    isLoading,
    acceptInvitation,
    rejectInvitation,
    refreshOrganizations,
  } = useAuth();

  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Anonymous users can't accept — bounce to /login with a return URL.
  useEffect(() => {
    if (isLoading) return;
    if (!user && invitationId) {
      const next = `/accept-invitation/${invitationId}`;
      navigate(`/login?redirect=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [isLoading, user, invitationId, navigate]);

  if (!invitationId) {
    return (
      <div className="flex min-h-svh w-full flex-col items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {t('acceptInvitation.invalidTitle', {
                defaultValue: 'Invalid invitation link',
              })}
            </CardTitle>
            <CardDescription>
              {t('acceptInvitation.invalidDescription', {
                defaultValue: 'The invitation id is missing from the URL.',
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptInvitation(invitationId);
      await refreshOrganizations().catch(() => undefined);
      toast.success(
        t('acceptInvitation.accepted', { defaultValue: 'Invitation accepted' }),
      );
      navigate('/organizations');
    } catch (err) {
      toast.error(
        t('acceptInvitation.acceptFailed', { defaultValue: 'Could not accept' }),
        { description: (err as Error).message },
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await rejectInvitation(invitationId);
      toast.success(
        t('acceptInvitation.declined', { defaultValue: 'Invitation declined' }),
      );
      navigate('/organizations');
    } catch (err) {
      toast.error(
        t('acceptInvitation.declineFailed', { defaultValue: 'Could not decline' }),
        { description: (err as Error).message },
      );
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {t('acceptInvitation.title', {
                defaultValue: 'Accept organization invitation',
              })}
            </CardTitle>
            <CardDescription>
              {t('acceptInvitation.description', {
                defaultValue: "You've been invited to join an organization.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={accepting || rejecting}
            >
              {accepting
                ? t('acceptInvitation.accepting', { defaultValue: 'Accepting…' })
                : t('acceptInvitation.accept', { defaultValue: 'Accept invitation' })}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReject}
              disabled={accepting || rejecting}
            >
              {rejecting
                ? t('acceptInvitation.declining', { defaultValue: 'Declining…' })
                : t('acceptInvitation.decline', { defaultValue: 'Decline' })}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AcceptInvitationPage;

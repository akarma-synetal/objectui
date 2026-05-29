/**
 * OAuthConsentPage — /oauth/consent screen.
 *
 * Ported from `framework/apps/account/src/routes/oauth.consent.tsx`.
 *
 * The `@better-auth/oauth-provider` plugin redirects the user here when
 * an OAuth client requests consent. The full query string (including the
 * signed `sig`/`exp` carrier) is the canonical authorization request and
 * must be forwarded back to the consent endpoint as `oauth_query` so the
 * server can verify and re-issue an authorization code.
 *
 * After accept/deny we POST to `/api/v1/auth/oauth2/consent` which
 * returns `{ redirect_uri }` pointing at the OAuth client's callback.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, KeyRound, X } from 'lucide-react';
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

const AUTH_BASE = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

interface OAuthClientPublicInfo {
  name?: string;
  client_name?: string;
  icon?: string;
  logo_uri?: string;
}

export function OAuthConsentPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [clientInfo, setClientInfo] = useState<OAuthClientPublicInfo | null>(null);

  // Read raw query so the signed `sig=` is forwarded verbatim.
  const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
  const oauthQuery = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const params = new URLSearchParams(oauthQuery);
  const clientId = params.get('client_id') ?? undefined;
  const scope = params.get('scope') ?? '';

  // Unauthenticated → bounce to /login with a return-to that brings the
  // user back here once signed in.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const here = window.location.pathname + window.location.search;
      navigate(`/login?redirect=${encodeURIComponent(here)}`, { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Best-effort lookup of the client app's display name + icon.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    fetch(`${AUTH_BASE}/oauth2/applications/${encodeURIComponent(clientId)}/public`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const payload = (data as { data?: OAuthClientPublicInfo })?.data ?? data;
        setClientInfo(payload as OAuthClientPublicInfo);
      })
      .catch(() => {
        /* ignore — fall back to the bare client_id */
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const scopes = scope.split(/\s+/).filter(Boolean);

  const handleDecision = async (accept: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${AUTH_BASE}/oauth2/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accept, oauth_query: oauthQuery }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string })?.message || `Consent failed: ${res.status}`,
        );
      }
      const redirect =
        (data as { redirect_uri?: string; redirectURI?: string; url?: string })
          .redirect_uri ??
        (data as { redirectURI?: string }).redirectURI ??
        (data as { url?: string }).url;
      if (redirect) {
        window.location.href = redirect;
        return;
      }
      const title = accept
        ? t('oauth.consent.granted', { defaultValue: 'Access granted' })
        : t('oauth.consent.denied', { defaultValue: 'Access denied' });
      toast(title, {
        description: t('oauth.consent.noRedirect', {
          defaultValue: 'No redirect URL returned by the server.',
        }),
      });
    } catch (err) {
      toast.error(
        t('oauth.consent.failed', { defaultValue: 'Consent failed' }),
        { description: (err as Error).message },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const appName =
    clientInfo?.name ??
    clientInfo?.client_name ??
    clientId ??
    t('oauth.consent.unknownApp', { defaultValue: 'an application' });

  return (
    <div className="flex min-h-svh w-full flex-1 items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-3 rounded-full border bg-muted p-3">
            {clientInfo?.icon || clientInfo?.logo_uri ? (
              <img
                src={clientInfo.icon || clientInfo.logo_uri}
                alt=""
                className="h-8 w-8 rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <KeyRound className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="text-xl">
            {t('oauth.consent.title', {
              appName,
              defaultValue: `${appName} wants to access your account`,
            })}
          </CardTitle>
          <CardDescription>
            {t('oauth.consent.request', {
              appName,
              suffix: user?.email ? ` (${user.email})` : '',
              defaultValue: `${appName} is requesting permission${
                user?.email ? ` for ${user.email}` : ''
              }.`,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">
                {t('oauth.consent.willAllow', {
                  defaultValue: 'This app will be able to:',
                })}
              </p>
              <ul className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                {scopes.map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>{describeScope(s, t)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => handleDecision(false)}
              disabled={submitting}
            >
              <X className="mr-2 h-4 w-4" />
              {t('oauth.consent.deny', { defaultValue: 'Deny' })}
            </Button>
            <Button onClick={() => handleDecision(true)} disabled={submitting}>
              <Check className="mr-2 h-4 w-4" />
              {submitting
                ? t('oauth.consent.submitting', { defaultValue: 'Authorizing…' })
                : t('oauth.consent.authorize', { defaultValue: 'Authorize' })}
            </Button>
          </div>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            {t('oauth.consent.footer', {
              defaultValue: 'You can revoke access at any time from your account settings.',
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function describeScope(
  scope: string,
  t: ReturnType<typeof useObjectTranslation>['t'],
): string {
  switch (scope) {
    case 'openid':
      return t('oauth.consent.scope.openid', {
        defaultValue: 'Confirm your identity',
      });
    case 'profile':
      return t('oauth.consent.scope.profile', {
        defaultValue: 'Read your basic profile (name, picture)',
      });
    case 'email':
      return t('oauth.consent.scope.email', {
        defaultValue: 'Read your email address',
      });
    case 'offline_access':
      return t('oauth.consent.scope.offlineAccess', {
        defaultValue: 'Stay signed in (refresh access)',
      });
    default:
      return scope;
  }
}

export default OAuthConsentPage;

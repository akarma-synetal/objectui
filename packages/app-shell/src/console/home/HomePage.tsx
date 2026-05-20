/**
 * HomePage
 *
 * Unified Home Dashboard (Workspace) that displays all available applications,
 * quick actions, recent items, and favorites. Inspired by Airtable/Notion home pages.
 *
 * Features:
 * - Display all active applications as cards
 * - Quick actions for creating apps, importing data, etc.
 * - Recent apps section (from useRecentItems)
 * - Starred/Favorite apps section (from useFavorites)
 * - Empty state guidance for new users
 * - Responsive grid layout
 * - i18n support
 *
 * @module
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMetadata } from '../../providers/MetadataProvider';
import { useRecentItems } from '../../hooks/useRecentItems';
import { useFavorites } from '../../hooks/useFavorites';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAuth } from '@object-ui/auth';
import { AppCard } from './AppCard';
import { RecentApps } from './RecentApps';
import { StarredApps } from './StarredApps';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { Plus, Settings, Sparkles, Star, Clock, ArrowDown } from 'lucide-react';

function pickGreetingKey(hour: number): string {
  if (hour < 5) return 'home.greetingNight';
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  if (hour < 23) return 'home.greetingEvening';
  return 'home.greetingNight';
}

/**
 * Friendly onboarding hint shown above the All Apps grid when the user has
 * no starred or recent items yet. Replaces per-section empty states (which
 * would flicker as the backend adapter hydrates).
 */
function GettingStartedHint({ t }: { t: (key: string, opts?: any) => string }) {
  return (
    <section
      data-testid="home-getting-started"
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-fuchsia-500/5"
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400">
            <Star className="h-5 w-5" />
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Clock className="h-5 w-5" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {t('home.gettingStarted.title', { defaultValue: 'Make this home yours' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t('home.gettingStarted.description', {
              defaultValue:
                'Star an app to pin it here for one-click access. Anything you open will show up under Recently Accessed automatically.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{t('home.gettingStarted.cta', { defaultValue: 'Browse all applications' })}</span>
          <ArrowDown className="h-3.5 w-3.5" />
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { apps, loading } = useMetadata();
  const { recentItems } = useRecentItems();
  const { favorites } = useFavorites();
  const { user } = useAuth();

  const activeApps = apps.filter((a: any) => a.active !== false);

  const recentApps = recentItems
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page')
    .slice(0, 6);

  const starredApps = favorites
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page')
    .slice(0, 8);

  const greeting = useMemo(() => t(pickGreetingKey(new Date().getHours()), { defaultValue: 'Welcome' }), [t]);
  const displayName = (user?.name?.trim() || user?.email?.split('@')[0] || '').trim();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-muted-foreground">{t('home.loading', { defaultValue: 'Loading workspace...' })}</div>
      </div>
    );
  }

  if (activeApps.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Empty>
          <EmptyTitle>{t('home.welcome', { defaultValue: 'Welcome to ObjectUI' })}</EmptyTitle>
          <EmptyDescription>
            {t('home.welcomeDescription', {
              defaultValue:
                'Get started by creating your first application or configure your system settings.',
            })}
          </EmptyDescription>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Button onClick={() => navigate('/create-app')} data-testid="create-first-app-btn">
              <Plus className="mr-2 h-4 w-4" />
              {t('home.createFirstApp', { defaultValue: 'Create Your First App' })}
            </Button>
            <Button variant="outline" onClick={() => navigate('/apps/setup')} data-testid="go-to-settings-btn">
              <Settings className="mr-2 h-4 w-4" />
              {t('home.systemSettings', { defaultValue: 'System Settings' })}
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-full bg-gradient-to-b from-background via-background to-muted/40">
      {/* Decorative ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-3xl opacity-70 dark:opacity-40" />
        <div className="absolute -top-20 right-[-6rem] h-[26rem] w-[36rem] rounded-full bg-sky-400/30 blur-3xl opacity-70 dark:opacity-35" />
        <div className="absolute top-32 left-1/3 h-[18rem] w-[24rem] rounded-full bg-fuchsia-400/25 blur-3xl opacity-60 dark:opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="uppercase tracking-wider">{t('home.title', { defaultValue: 'Home' })}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {greeting}
              {displayName ? `, ${displayName}` : ''}
            </span>
            <span className="text-foreground/40">.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2 max-w-2xl">
            {t('home.heroTagline', { defaultValue: 'Pick up where you left off, or explore something new.' })}
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto space-y-10">
          {starredApps.length === 0 && recentApps.length === 0 && (
            <GettingStartedHint t={t} />
          )}
          {starredApps.length > 0 && <StarredApps items={starredApps} />}
          {recentApps.length > 0 && <RecentApps items={recentApps} />}

          <section>
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {t('home.allApps', { defaultValue: 'All Applications' })}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeApps.length}
                  {' · '}
                  {t('home.stats.apps', { defaultValue: 'Applications' })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeApps.map((app: any, idx: number) => (
                <AppCard
                  key={app.name}
                  app={app}
                  index={idx}
                  onClick={() => navigate(`/apps/${app.name}`)}
                  isFavorite={favorites.some(f => f.id === `app:${app.name}`)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

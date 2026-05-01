import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@object-ui/components';
import { cn } from '@object-ui/components';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, AlertCircle, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

/** Resolve an I18nLabel (string or {key, defaultValue}) to a plain string. */
function resolveLabel(label: string | { key?: string; defaultValue?: string } | undefined): string | undefined {
  if (label === undefined || label === null) return undefined;
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key;
}

export type MetricColorVariant =
  | 'default' | 'blue' | 'teal' | 'orange' | 'purple'
  | 'success' | 'warning' | 'danger';

/**
 * Static map of color variants → Tailwind class strings.
 * Defined statically so Tailwind v4's content scanner picks them up.
 * Each variant tints the icon container with a soft background + bold foreground,
 * keeping the rest of the card in the neutral Shadcn palette.
 */
const VARIANT_ICON_CLASSES: Record<MetricColorVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  teal:    'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  orange:  'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  purple:  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger:  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

export interface MetricWidgetProps {
  label: string | { key?: string; defaultValue?: string };
  value: string | number;
  trend?: {
    value: number;
    label?: string | { key?: string; defaultValue?: string };
    direction?: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode | string;
  className?: string;
  description?: string | { key?: string; defaultValue?: string };
  /** When true, the widget is in a loading state (fetching data from server). */
  loading?: boolean;
  /** Error message from a failed data fetch. When set, the widget shows an error state. */
  error?: string | null;
  /** Visual color variant — tints the icon container while keeping the card neutral. */
  colorVariant?: MetricColorVariant;
}

export const MetricWidget = ({
  label,
  value,
  trend,
  icon,
  className,
  description,
  loading,
  error,
  colorVariant = 'default',
  ...props
}: MetricWidgetProps) => {
  const iconClasses = VARIANT_ICON_CLASSES[colorVariant] || VARIANT_ICON_CLASSES.default;

  // Resolve icon if it's a string
  const resolvedIcon = useMemo(() => {
    if (typeof icon === 'string') {
        const IconComponent = (LucideIcons as any)[icon];
        return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
    }
    return icon;
  }, [icon]);

  return (
    <Card className={cn("h-full overflow-hidden", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {resolveLabel(label)}
        </CardTitle>
        {resolvedIcon && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md shrink-0",
              iconClasses,
            )}
          >
            {resolvedIcon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="metric-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2" data-testid="metric-error" role="alert">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive truncate">{error}</span>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold truncate">{value}</div>
            {(trend || description) && (
              <p className="text-xs text-muted-foreground flex items-center mt-1 truncate">
                {trend && (
                  <span className={cn(
                    "flex items-center mr-2 shrink-0 font-medium",
                    trend.direction === 'up' && "text-emerald-600 dark:text-emerald-400",
                    trend.direction === 'down' && "text-rose-600 dark:text-rose-400",
                    trend.direction === 'neutral' && "text-muted-foreground"
                  )}>
                    {trend.direction === 'up' && <ArrowUpIcon className="h-3 w-3 mr-1" />}
                    {trend.direction === 'down' && <ArrowDownIcon className="h-3 w-3 mr-1" />}
                    {trend.direction === 'neutral' && <MinusIcon className="h-3 w-3 mr-1" />}
                    {trend.value}%
                  </span>
                )}
                <span className="truncate">{resolveLabel(description) || resolveLabel(trend?.label)}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

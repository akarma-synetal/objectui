import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { Button, cn, useSidebar } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';

export const LocalizedSidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, 'aria-label': ariaLabel, title, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  const { t } = useObjectTranslation();
  const label = String(ariaLabel || title || t('common.toggleSidebar', { defaultValue: 'Toggle sidebar' }));

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      aria-label={label}
      title={label}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">{label}</span>
    </Button>
  );
});

LocalizedSidebarTrigger.displayName = 'LocalizedSidebarTrigger';

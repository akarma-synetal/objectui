import React from 'react';
import { cn } from '@object-ui/components';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function PageHeader({ 
    title, 
    description, 
    action,
    className, 
    children, 
    ...props 
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col gap-4 pb-4 md:pb-8", className)} {...props}>
            {/* Title + primary action sit together (left-aligned). Pushing the
                action to the far right of the viewport on wide screens
                disconnects it from the title context. The flex-wrap allows
                the action to drop to a second row on narrow viewports. */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="flex flex-col gap-1 min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl truncate">{title}</h1>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>
                {(action || children) && (
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                        {action}
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}

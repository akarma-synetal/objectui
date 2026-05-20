import React from 'react';
import { cn } from '@object-ui/components';
import { useRecordContext } from '@object-ui/react';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

/**
 * Replace `{field.path}` tokens in a template string against record data.
 * Missing fields collapse to empty strings; consecutive whitespace is
 * collapsed so partial misses don't leave gaping holes in the header.
 * If no `{` is present, the template is returned as-is.
 */
const interpolateTitle = (template: string | undefined, data: unknown): string => {
    if (!template || typeof template !== 'string') return template ?? '';
    if (!template.includes('{')) return template;
    const out = template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, path: string) => {
        const v = path
            .split('.')
            .reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), data);
        return v == null ? '' : String(v);
    });
    return out.replace(/\s+/g, ' ').trim();
};

export function PageHeader({
    title,
    description,
    action,
    className,
    children,
    ...props
}: PageHeaderProps) {
    const ctx = useRecordContext();
    const resolvedTitle = interpolateTitle(title, ctx?.data) || title;
    const resolvedDescription = interpolateTitle(description, ctx?.data) || description;
    return (
        <div className={cn("flex flex-col gap-4 pb-4 md:pb-8", className)} {...props}>
            {/* Title + primary action sit together (left-aligned). Pushing the
                action to the far right of the viewport on wide screens
                disconnects it from the title context. The flex-wrap allows
                the action to drop to a second row on narrow viewports. */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="flex flex-col gap-1 min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl truncate">{resolvedTitle}</h1>
                    {resolvedDescription && <p className="text-sm text-muted-foreground">{resolvedDescription}</p>}
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

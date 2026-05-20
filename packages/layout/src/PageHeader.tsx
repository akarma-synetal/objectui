import React from 'react';
import { cn, LazyIcon } from '@object-ui/components';
import { useRecordContext, SchemaRenderer } from '@object-ui/react';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    /**
     * Optional secondary line under the title. Spec schemas use `subtitle`,
     * the legacy console pages use `description` — both are supported and
     * resolve {field.path} tokens against the current record context.
     */
    subtitle?: string;
    description?: string;
    /**
     * Optional icon for the header chip. Accepts either a string Lucide icon
     * name (resolved via `LazyIcon`, the standard ObjectUI helper) or a
     * pre-rendered React node.
     */
    icon?: React.ReactNode | string;
    action?: React.ReactNode;
    /**
     * When rendered from a schema, `SchemaRenderer` injects the full schema
     * node so we can render its `children` into the right-aligned action
     * slot (Salesforce Lightning-style header). React children passed at
     * the JSX call site take precedence over schema children.
     */
    schema?: { children?: unknown[] };
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
    subtitle,
    description,
    icon,
    action,
    schema,
    className,
    children,
    ...props
}: PageHeaderProps) {
    const ctx = useRecordContext();
    const resolvedTitle = interpolateTitle(title, ctx?.data) || title;
    // `subtitle` wins over `description` when both are present so spec schemas
    // (which use subtitle) override the legacy alias cleanly.
    const secondaryRaw = subtitle ?? description;
    const resolvedSecondary = interpolateTitle(secondaryRaw, ctx?.data) || secondaryRaw;

    // Render schema-declared children into the action slot. `SchemaRenderer`
    // strips `children` from the React tree (treats them as metadata), so
    // we re-introduce them here for components like `record:quick_actions`
    // nested under `page:header.children`.
    const schemaChildren = Array.isArray(schema?.children)
        ? (schema!.children as any[])
              .filter(Boolean)
              .map((child, idx) => (
                  <SchemaRenderer key={(child?.id as string) || `pgh-child-${idx}`} schema={child} />
              ))
        : null;
    const slot = action || children || schemaChildren;

    return (
        <div className={cn('flex flex-col gap-3 pb-4 border-b', className)} {...props}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {icon && (
                    <div className="flex-shrink-0 grid place-items-center size-10 rounded-md bg-primary/10 text-primary">
                        {typeof icon === 'string' ? <LazyIcon name={icon} className="size-5" /> : icon}
                    </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl truncate">{resolvedTitle}</h1>
                    {resolvedSecondary && <p className="text-sm text-muted-foreground truncate">{resolvedSecondary}</p>}
                </div>
                {slot && <div className="flex items-center gap-2 ml-auto">{slot}</div>}
            </div>
        </div>
    );
}

import React from 'react';
import { cn, LazyIcon, Button } from '@object-ui/components';
import { ArrowLeft } from 'lucide-react';
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
     * Show a back arrow at the left of the header that navigates one level
     * up the URL (e.g. /apps/{app}/{obj}/record/{id} → /apps/{app}/{obj}).
     * Defaults to true on record pages and false otherwise — the inference
     * is based on whether a record context with a recordId is available.
     */
    showBack?: boolean;
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
        if (v == null) return '';
        // When a lookup field was $expanded, the value is an object like
        // { id, name, ... } — render the display name instead of [object Object].
        if (typeof v === 'object') {
            const display = (v as any).name ?? (v as any).label ?? (v as any).display_name ?? (v as any).title;
            return display == null ? '' : String(display);
        }
        return String(v);
    });
    return out.replace(/\s+/g, ' ').trim();
};

export function PageHeader({
    title,
    subtitle,
    description,
    icon,
    action,
    showBack,
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

    // Default-on for record pages (a recordId in scope is the cheapest tell
    // that the user navigated from a list view). The host can override with
    // `showBack={false}` for embedded contexts (drawers, modals).
    const isRecordPage = !!ctx?.recordId;
    const shouldShowBack = showBack ?? isRecordPage;
    const handleBack = React.useCallback(() => {
        // Strip a trailing `/record/{id}` (or any one-segment leaf) to land
        // on the list view. If the URL doesn't match, fall back to browser
        // history so deep-linked users still get a usable affordance.
        if (typeof window === 'undefined') return;
        const path = window.location.pathname;
        const parent = path.replace(/\/record\/[^/]+\/?$/, '');
        if (parent !== path) {
            window.history.pushState({}, '', parent + window.location.search);
            // SPA routers listen on popstate, dispatch it so they re-render.
            window.dispatchEvent(new PopStateEvent('popstate'));
        } else if (window.history.length > 1) {
            window.history.back();
        }
    }, []);

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
                {shouldShowBack && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleBack}
                        aria-label="Back to list"
                        className="flex-shrink-0 -ml-2"
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                )}
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

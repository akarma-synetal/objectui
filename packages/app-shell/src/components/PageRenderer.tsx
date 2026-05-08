import { useObjectTranslation } from '@object-ui/i18n';
import type { PageRendererProps } from '../types';

/**
 * PageRenderer - Renders custom page schemas
 *
 * Framework-agnostic component that renders a page based on JSON schema.
 */
export function PageRenderer({ schema, pageName }: PageRendererProps) {
  const { t } = useObjectTranslation();
  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('renderer.noPageSchema')}</div>
      </div>
    );
  }

  return (
    <div className="page-renderer h-full p-4">
      <h1 className="mb-4 text-2xl font-bold">
        {schema.title || pageName || t('renderer.page')}
      </h1>
      {/* TODO: Integrate with actual SchemaRenderer for page */}
      <div className="text-muted-foreground">
        {t('renderer.pageRendering', { name: schema.title || pageName })}
      </div>
    </div>
  );
}

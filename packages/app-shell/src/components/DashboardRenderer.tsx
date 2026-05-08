import { SchemaRendererProvider } from '@object-ui/react';
import { useObjectTranslation } from '@object-ui/i18n';
import type { DashboardRendererProps } from '../types';

/**
 * DashboardRenderer - Renders dashboard layouts from schema
 *
 * Framework-agnostic component that renders a dashboard based on JSON schema.
 * Delegates to registered dashboard plugins.
 */
export function DashboardRenderer({
  schema,
  dataSource,
  dashboardName,
}: DashboardRendererProps) {
  const { t } = useObjectTranslation();
  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('renderer.noDashboardSchema')}</div>
      </div>
    );
  }

  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <div className="dashboard-renderer h-full p-4">
        <h1 className="mb-4 text-2xl font-bold">
          {schema.title || dashboardName || t('renderer.dashboard')}
        </h1>
        {/* TODO: Integrate with actual SchemaRenderer for dashboard */}
        <div className="text-muted-foreground">
          {t('renderer.dashboardRendering', { name: schema.title || dashboardName })}
        </div>
      </div>
    </SchemaRendererProvider>
  );
}

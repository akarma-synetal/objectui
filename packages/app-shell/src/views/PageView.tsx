/**
 * Page View Component
 *
 * Renders a custom page based on the pageName parameter. Page authoring
 * happens via the metadata admin (JSON form / preview tabs); no bespoke
 * canvas editor is offered here.
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { FileText } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../providers/MetadataProvider';

export function PageView() {
  const { t } = useObjectTranslation();
  const { pageName } = useParams<{ pageName: string }>();
  const [searchParams] = useSearchParams();
  const { showDebug } = useMetadataInspector();

  const { pages } = useMetadata();
  const page = pages?.find((p: any) => p.name === pageName);

  if (!page) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.pageNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('empty.pageNotFoundDescription', { name: pageName })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const params = Object.fromEntries(searchParams.entries());

  return (
    <div className="flex flex-row h-full w-full overflow-hidden relative">
      <div className="flex-1 overflow-auto h-full relative">
        <SchemaRenderer
          schema={{
            ...page,
            type: (page as any).type || 'page',
            context: { ...(page as any).context, params },
          }}
        />
      </div>
      <MetadataPanel
        open={showDebug}
        sections={[{ title: 'Page Configuration', data: page }]}
      />
    </div>
  );
}

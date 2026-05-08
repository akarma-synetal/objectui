import { SchemaRendererProvider } from '@object-ui/react';
import { useObjectTranslation } from '@object-ui/i18n';
import type { FormRendererProps } from '../types';

/**
 * FormRenderer - Renders forms (modal or inline)
 *
 * Framework-agnostic component that renders a form based on schema.
 * Handles both create and edit modes.
 */
export function FormRenderer({
  schema,
  dataSource,
  mode = 'create',
  recordId,
  onSuccess,
  onCancel,
  objectDef,
}: FormRendererProps) {
  const { t } = useObjectTranslation();
  if (!schema) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-muted-foreground">{t('renderer.noFormSchema')}</div>
      </div>
    );
  }

  const handleSubmit = async (data: any) => {
    try {
      if (mode === 'create' && objectDef) {
        const result = await dataSource.create(objectDef.name, data);
        onSuccess?.(result);
      } else if (mode === 'edit' && recordId && objectDef) {
        const result = await dataSource.update(objectDef.name, recordId, data);
        onSuccess?.(result);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <div className="form-renderer p-4">
        <h2 className="mb-4 text-xl font-semibold">
          {schema.title || (mode === 'create' ? t('renderer.createRecord') : t('renderer.editRecord'))}
        </h2>
        {/* TODO: Integrate with actual form renderer */}
        <div className="text-muted-foreground">
          {t('renderer.formRenderingMode', { mode })}
          {recordId && ` ${t('renderer.formRenderingFor', { id: recordId })}`}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleSubmit({})}
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
          >
            {t('renderer.save')}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded border px-4 py-2"
            >
              {t('renderer.cancel')}
            </button>
          )}
        </div>
      </div>
    </SchemaRendererProvider>
  );
}

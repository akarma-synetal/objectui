/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:details` — page-level record component that renders the canonical
 * field-detail block. Reads the bound record from <RecordContextProvider> and
 * synthesizes a DetailViewSchema for the existing DetailView component.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import type { RecordDetailsComponentProps } from '@object-ui/types';
import { DetailView } from '../DetailView';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordDetailsRendererProps {
  schema?: RecordDetailsComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordDetailsRenderer: React.FC<RecordDetailsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);

  // Studio designer / palette: render an empty shell when no record bound.
  if (!ctx) {
    return (
      <div
        className={className}
        data-record-details-placeholder
        {...designer}
      >
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:details — bind a record to preview
        </div>
      </div>
    );
  }

  const layout: 'vertical' | 'horizontal' =
    schema.layout === 'inline' || schema.layout === 'compact' ? 'horizontal' : 'vertical';

  const synthesized: any = {
    type: 'detail-view',
    objectName: ctx.objectName,
    resourceId: ctx.recordId as any,
    data: ctx.data,
    layout,
    columns: schema.columns,
    sections: schema.sections,
    fields: schema.fields,
    showBack: false,
  };

  return (
    <div className={className} {...designer}>
      <DetailView schema={synthesized} dataSource={ctx.dataSource as any} />
    </div>
  );
};

export default RecordDetailsRenderer;

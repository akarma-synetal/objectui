/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:highlights` — top-of-page key fact strip (Salesforce-style
 * Highlights Panel). Adapts the spec's `fields: string[]` to the legacy
 * HeaderHighlight component which expects `HighlightField[]`.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import type { RecordHighlightsComponentProps } from '@object-ui/types';
import { HeaderHighlight } from '../HeaderHighlight';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordHighlightsRendererProps {
  schema?: RecordHighlightsComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordHighlightsRenderer: React.FC<RecordHighlightsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);

  const names: string[] = Array.isArray(schema.fields) ? schema.fields : [];
  const highlightFields = names.map((name) => ({ name }));

  return (
    <div className={className} {...designer}>
      <HeaderHighlight
        fields={highlightFields as any}
        data={ctx?.data}
        objectName={ctx?.objectName}
        objectSchema={ctx?.objectSchema as any}
      />
    </div>
  );
};

export default RecordHighlightsRenderer;

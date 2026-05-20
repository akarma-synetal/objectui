/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:chatter` — Salesforce-style social feed for the current record.
 * Delegates to the existing RecordChatterPanel; real feed wiring lives there.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import type { RecordChatterComponentProps } from '@object-ui/types';
import { RecordChatterPanel } from '../RecordChatterPanel';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordChatterRendererProps {
  schema?: RecordChatterComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordChatterRenderer: React.FC<RecordChatterRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  useRecordContext();
  const { designer } = splitDesigner(props);

  return (
    <div className={className} {...designer}>
      <RecordChatterPanel
        items={[] as any}
        config={schema as any}
      />
    </div>
  );
};

export default RecordChatterRenderer;

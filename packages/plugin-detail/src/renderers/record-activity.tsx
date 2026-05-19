/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:activity` — unified activity feed (tasks, events, calls, comments)
 * scoped to the current record. Delegates to the existing
 * RecordActivityTimeline. Real data wiring (sys_activity / sys_comment
 * polling) lives inside that component; here we just pass the schema as
 * `config` and a placeholder empty feed for static rendering.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import type { RecordActivityComponentProps } from '@object-ui/types';
import { RecordActivityTimeline } from '../RecordActivityTimeline';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordActivityRendererProps {
  schema?: RecordActivityComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordActivityRenderer: React.FC<RecordActivityRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);

  return (
    <div className={className} {...designer}>
      <RecordActivityTimeline
        items={[] as any}
        config={schema as any}
        objectName={ctx?.objectName as any}
        recordId={ctx?.recordId as any}
      />
    </div>
  );
};

export default RecordActivityRenderer;

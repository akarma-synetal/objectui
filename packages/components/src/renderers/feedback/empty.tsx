/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { EmptySchema } from '@object-ui/types';
import { DataEmptyState } from '../../custom/view-states';

ComponentRegistry.register('empty', 
  ({ schema, ...props }: { schema: EmptySchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...emptyProps
    } = props;

    return (
      <DataEmptyState
        title={schema.title || 'No data'}
        description={schema.description}
        className={schema.className}
        {...emptyProps}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      />
    );
  },
  {
    namespace: 'ui',
    label: 'Empty',
    inputs: [
      { name: 'title', type: 'string', label: 'Title', defaultValue: 'No data' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      title: 'No data'
    }
  }
);

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Button } from '@object-ui/components';
import { Trash2, CheckSquare, X } from 'lucide-react';
import { formatActionLabel } from './RowActionMenu';

export interface BulkActionBarProps {
  /** Array of selected row records */
  selectedRows: any[];
  /** Bulk/batch action identifiers */
  actions: string[];
  /** Callback when a bulk action button is clicked */
  onAction?: (action: string, selectedRows: any[]) => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedRows,
  actions,
  onAction,
  onClearSelection,
}) => {
  if (!actions || actions.length === 0 || selectedRows.length === 0) {
    return null;
  }

  return (
    <div
      className="border-t border-primary/30 px-4 py-2 flex items-center gap-2 text-xs bg-primary/10 text-foreground shrink-0 shadow-sm"
      role="region"
      aria-label="Bulk actions"
      data-testid="bulk-actions-bar"
    >
      <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="font-medium">
        {selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'} selected
      </span>
      <div className="flex items-center gap-1.5 ml-3">
        {actions.map(action => {
          const actionStr = String(action).toLowerCase();
          const isDestructive = actionStr.includes('delete') || actionStr.includes('remove') || actionStr.includes('destroy');
          const Icon = isDestructive ? Trash2 : null;
          return (
            <Button
              key={action}
              variant={isDestructive ? 'destructive' : 'outline'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => onAction?.(action, selectedRows)}
              data-testid={`bulk-action-${action}`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {formatActionLabel(action)}
            </Button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs ml-auto gap-1"
        onClick={onClearSelection}
      >
        <X className="h-3 w-3" />
        Clear
      </Button>
    </div>
  );
};

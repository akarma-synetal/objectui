/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PageHeader Component
 *
 * Standardized page header used across console object/list/detail views.
 * Provides consistent typography, icon framing, and action grouping so
 * individual screens don't reinvent the title row.
 *
 * Layout:
 *   [icon]  Title             [actions...]
 *           description
 */

import * as React from 'react';
import { cn } from '@object-ui/components';

export interface PageHeaderProps {
  /** Page title (required, becomes <h1>). */
  title: React.ReactNode;
  /** Optional secondary description shown beneath the title. */
  description?: React.ReactNode;
  /** Optional leading icon (already-instantiated React element). */
  icon?: React.ReactNode;
  /** Right-aligned actions (buttons, dropdowns, etc.). */
  actions?: React.ReactNode;
  /** Additional className applied to the outer container. */
  className?: string;
  /** Optional data-testid for E2E selectors. */
  'data-testid'?: string;
}

/**
 * Reusable page header for the console.
 *
 * Mirrors Shadcn / Linear / Notion conventions: subtle border, comfortable
 * vertical padding, primary-tinted icon chip, monolithic action cluster on
 * the right with consistent gap.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
  'data-testid': testId,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex justify-between items-center gap-3 py-2.5 sm:py-3 px-3 sm:px-4 border-b shrink-0 bg-background z-10',
        className,
      )}
      data-testid={testId ?? 'page-header'}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {icon && (
          <div className="bg-primary/10 p-1.5 sm:p-2 rounded-md shrink-0 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-muted-foreground truncate hidden sm:block max-w-md">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;

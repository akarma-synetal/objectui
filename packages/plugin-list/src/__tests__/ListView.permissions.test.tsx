/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ListView } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';
import { PermissionProvider } from '@object-ui/permissions';
import type { ListViewSchema } from '@object-ui/types';
import type { ObjectPermissionConfig, RoleDefinition } from '@object-ui/types';

/**
 * Negative tests for ListView FLS — when the current user lacks read
 * permission on a column, it must disappear from the rendered table
 * (and, by extension, from the hide-fields popover, the filter
 * builder, and any $select that flows to the data source).
 *
 * We assert against the `$select` arg passed to dataSource.find rather
 * than rendered DOM text: the DOM depends on which list renderer is
 * registered (which varies between isolated `--filter` test runs and
 * the root `vitest run --coverage` combined run where other packages
 * register table renderers), but the $select contract is invariant.
 */

const roles: RoleDefinition[] = [
  { name: 'restricted', description: 'denies one field' },
];

function makeRestrictedConfig(deniedField: string): ObjectPermissionConfig {
  return {
    object: 'account',
    roles: {
      restricted: {
        roleName: 'restricted',
        objectPermissions: { read: true, create: false, update: false, delete: false },
        fieldPermissions: [{ field: deniedField, read: false, write: false }],
      },
    },
  };
}

const mockDataSource = {
  find: vi.fn().mockResolvedValue([
    { id: 'A1', name: 'Acme Co', annual_revenue: 1_000_000, industry: 'Tech' },
    { id: 'A2', name: 'Globex',  annual_revenue: 500_000,    industry: 'Energy' },
  ]),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const schema: ListViewSchema = {
  type: 'list-view',
  objectName: 'account',
  fields: ['name', 'industry', 'annual_revenue'],
};

function renderRestricted(deniedField: string) {
  return render(
    <SchemaRendererProvider dataSource={mockDataSource as any}>
      <PermissionProvider
        roles={roles}
        permissions={[makeRestrictedConfig(deniedField)]}
        userRoles={['restricted']}
      >
        <ListView schema={schema} dataSource={mockDataSource as any} />
      </PermissionProvider>
    </SchemaRendererProvider>,
  );
}

/** Pull the most-recent $select that ListView projected to the data source. */
function lastSelect(): string[] | undefined {
  const calls = mockDataSource.find.mock.calls;
  if (calls.length === 0) return undefined;
  const lastArgs = calls[calls.length - 1]?.[1];
  return lastArgs?.$select as string[] | undefined;
}

describe('ListView – field-level permission gating (negative)', () => {
  beforeEach(() => {
    mockDataSource.find.mockClear();
  });

  it('drops the denied column from the $select projection', async () => {
    renderRestricted('annual_revenue');
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    const select = lastSelect();
    // ListView always projects an explicit $select for trimmed payloads;
    // permission gating must remove the denied field from it.
    expect(select).toBeDefined();
    expect(select).not.toContain('annual_revenue');
    expect(select).toEqual(expect.arrayContaining(['industry', 'name']));
  });

  it('does not leak the denied value into any rendered cell', async () => {
    const { container } = renderRestricted('annual_revenue');
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    expect(container.textContent).not.toMatch(/1,000,000|1000000|500,000|500000/);
  });

  it('keeps the denied column in $select when no PermissionProvider is mounted', async () => {
    render(
      <SchemaRendererProvider dataSource={mockDataSource as any}>
        <ListView schema={schema} dataSource={mockDataSource as any} />
      </SchemaRendererProvider>,
    );
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    const select = lastSelect();
    expect(select).toBeDefined();
    expect(select).toContain('annual_revenue');
  });
});

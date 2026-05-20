/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
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
  fields: [
    { name: 'name', label: 'Name' },
    { name: 'industry', label: 'Industry' },
    { name: 'annual_revenue', label: 'Annual Revenue' },
  ],
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

describe('ListView – field-level permission gating (negative)', () => {
  it('drops the denied column from the constructed columns array', async () => {
    const { container } = renderRestricted('annual_revenue');
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    // ListView ships a JSON dump of its effective config when no
    // renderer is registered — we use that as ground truth for the
    // column list the user would see.
    expect(container.textContent).not.toContain('annual_revenue');
    expect(container.textContent).toContain('industry');
    expect(container.textContent).toContain('name');
  });

  it('does not leak the denied value into any rendered cell', async () => {
    const { container } = renderRestricted('annual_revenue');
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    expect(container.textContent).not.toMatch(/1,000,000|1000000|500,000|500000/);
  });

  it('keeps the denied column visible when no PermissionProvider is mounted', async () => {
    const { container } = render(
      <SchemaRendererProvider dataSource={mockDataSource as any}>
        <ListView schema={schema} dataSource={mockDataSource as any} />
      </SchemaRendererProvider>,
    );
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    expect(container.textContent).toContain('annual_revenue');
  });
});

---
title: "Data Connectivity"
---

ObjectUI follows the **Universal Adapter Pattern**. UI components do not hardcode transport details. They receive a `DataSource` implementation from `SchemaRendererProvider` and call a stable CRUD/query contract.

This keeps the renderer backend-agnostic: ObjectStack, REST, GraphQL, and proprietary backends can all be adapted behind the same interface.

## The Interface

The canonical interface lives in `@object-ui/types`:

```typescript
import type { QueryParams, QueryResult } from '@object-ui/types';

export interface DataSource<T = unknown> {
  find(resource: string, params?: QueryParams): Promise<QueryResult<T>>;
  findOne(resource: string, id: string | number, params?: QueryParams): Promise<T | null>;
  create(resource: string, data: Partial<T>): Promise<T>;
  update(
    resource: string,
    id: string | number,
    data: Partial<T>,
    opts?: { ifMatch?: string },
  ): Promise<T>;
  delete(
    resource: string,
    id: string | number,
    opts?: { ifMatch?: string },
  ): Promise<boolean>;

  getObjectSchema(objectName: string): Promise<unknown>;
}
```

`find()` returns a `QueryResult<T>` so components can receive both rows and pagination metadata:

```typescript
interface QueryResult<T = unknown> {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  cursor?: string;
  metadata?: Record<string, unknown>;
}
```

## Available Adapters

### ObjectStack Adapter (Official)

Use `@object-ui/data-objectstack` for ObjectStack-compatible backends.

```bash
pnpm add @object-ui/data-objectstack
```

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.your-instance.com'
});
```

## Usage

Inject the data source at the renderer boundary:

```tsx
import '@object-ui/components';
import '@object-ui/fields';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com'
});

function App() {
  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <SchemaRenderer schema={mySchema} />
    </SchemaRendererProvider>
  );
}
```

## Creating a Custom Adapter

If you have a proprietary backend, wrap its SDK or client in a `DataSource` implementation. Keep transport details in the adapter, not in renderers.

```typescript
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';

type User = {
  id: string;
  name: string;
  email: string;
};

type BackendClient = {
  listUsers(params?: QueryParams): Promise<{ rows: User[]; total?: number }>;
  getUser(id: string | number): Promise<User | null>;
  createUser(data: Partial<User>): Promise<User>;
  updateUser(id: string | number, data: Partial<User>): Promise<User>;
  deleteUser(id: string | number): Promise<boolean>;
  describeObject(name: string): Promise<unknown>;
};

class UserDataSource implements DataSource<User> {
  constructor(private readonly client: BackendClient) {}

  async find(resource: string, params?: QueryParams): Promise<QueryResult<User>> {
    if (resource !== 'users') {
      return { data: [], total: 0 };
    }

    const result = await this.client.listUsers(params);
    return {
      data: result.rows,
      total: result.total,
    };
  }

  findOne(_resource: string, id: string | number): Promise<User | null> {
    return this.client.getUser(id);
  }

  create(_resource: string, data: Partial<User>): Promise<User> {
    return this.client.createUser(data);
  }

  update(_resource: string, id: string | number, data: Partial<User>): Promise<User> {
    return this.client.updateUser(id, data);
  }

  delete(_resource: string, id: string | number): Promise<boolean> {
    return this.client.deleteUser(id);
  }

  getObjectSchema(objectName: string): Promise<unknown> {
    return this.client.describeObject(objectName);
  }
}
```

## Query Parameters

ObjectUI uses OData-style query keys for broad compatibility:

```typescript
await dataSource.find('users', {
  $select: ['id', 'name', 'email'],
  $filter: { status: 'active' },
  $orderby: { name: 'asc' },
  $skip: 0,
  $top: 25,
  $count: true,
});
```

Data-aware plugins may also use optional methods such as `bulkUpdate`, `bulkDelete`, `getView`, or `listViewOverrides` when an adapter supports them. Keep the required CRUD methods implemented first, then add optional capabilities as your UI needs them.

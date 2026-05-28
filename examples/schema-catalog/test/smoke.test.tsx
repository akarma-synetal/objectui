/**
 * Smoke test for the schema catalog.
 *
 * Every entry in the catalog is mounted with <SchemaRenderer>. The assertion
 * is intentionally minimal: the render must not throw and must produce DOM.
 * This catches:
 *
 *   - JSON syntax errors (caught at import time by the JSON loader)
 *   - Unknown component types (renderer logs an error / renders nothing)
 *   - Missing required props that crash a renderer
 *   - Schemas that drift after a breaking change to a primitive
 *
 * It does NOT check pixel-perfect output — visual regression is out of scope
 * here. The goal is "does this example still produce a valid tree?".
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

import { SchemaRenderer, SchemaRendererContext } from '@object-ui/react';
import type { SchemaNode } from '@object-ui/core';
import { allExamples } from '../src/index.js';

const ctx = { dataSource: {} };

function Harness({ schema }: { schema: SchemaNode }) {
  return (
    <SchemaRendererContext.Provider value={ctx}>
      <SchemaRenderer schema={schema} />
    </SchemaRendererContext.Provider>
  );
}

describe('schema-catalog smoke', () => {
  const examples = allExamples();

  it('registry is non-empty', () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples.map((e) => [e.id, e]))(
    '%s renders without throwing',
    (_id, example) => {
      const { container } = render(<Harness schema={example.schema as SchemaNode} />);
      expect(container.firstChild).not.toBeNull();
      cleanup();
    },
  );
});

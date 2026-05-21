/**
 * Tests for PageHeaderRenderer header actions slot.
 *
 * Custom (authored) record detail pages embed action buttons directly on
 * `page:header.actions` (or `.properties.actions`). Without this slot,
 * actions such as Lead → "Convert Lead" silently disappear.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import {
  ActionProvider,
  RecordContextProvider,
} from '@object-ui/react';

function PageHeader({ schema }: { schema: any }) {
  const Component = ComponentRegistry.get('page:header');
  if (!Component) throw new Error('page:header not registered');
  return <Component schema={schema} />;
}

function renderHeader(schema: any, opts?: { record?: any; objectSchema?: any; execute?: any }) {
  const execute = opts?.execute ?? vi.fn(async () => ({ success: true }));
  const ui = (
    <ActionProvider>
      {opts?.record !== undefined ? (
        <RecordContextProvider
          objectName="lead"
          recordId={opts.record?.id ?? null}
          data={opts.record}
          objectSchema={opts?.objectSchema ?? { name: 'lead', label: 'Lead' }}
        >
          <PageHeader schema={schema} />
        </RecordContextProvider>
      ) : (
        <PageHeader schema={schema} />
      )}
    </ActionProvider>
  );
  const utils = render(ui);
  return { ...utils, execute };
}

describe('PageHeaderRenderer — actions slot', () => {
  it('renders inline schema.actions as buttons', () => {
    renderHeader({
      type: 'page:header',
      title: 'Lead',
      actions: [
        { name: 'convert', label: 'Convert Lead', type: 'flow' },
      ],
    });
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('renders schema.properties.actions (spec bridge variant)', () => {
    renderHeader({
      type: 'page:header',
      properties: {
        title: 'Lead',
        actions: [
          { name: 'convert', label: 'Convert Lead', type: 'flow' },
        ],
      },
    });
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('skips actions whose locations exclude record_header', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'a', label: 'Header Action', locations: ['record_header'] },
        { name: 'b', label: 'List Only', locations: ['list_item'] },
      ],
    });
    expect(screen.getByRole('button', { name: /Header Action/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /List Only/i })).toBeNull();
  });

  it('shows action when visible expression matches record', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [
          {
            name: 'convert',
            label: 'Convert Lead',
            visible: 'record.status == "qualified"',
          },
        ],
      },
      { record: { id: '1', status: 'qualified' } },
    );
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('hides action when visible expression does not match record', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [
          {
            name: 'convert',
            label: 'Convert Lead',
            visible: 'record.status == "qualified"',
          },
        ],
      },
      { record: { id: '1', status: 'new' } },
    );
    expect(screen.queryByRole('button', { name: /Convert Lead/i })).toBeNull();
  });

  it('honors structured visible: { dialect, source }', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [
          {
            name: 'convert',
            label: 'Convert Lead',
            visible: { dialect: 'cel', source: 'record.status == "qualified"' },
          },
        ],
      },
      { record: { id: '1', status: 'qualified' } },
    );
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('respects hidden: true', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'shown', label: 'Shown' },
        { name: 'gone', label: 'Hidden Action', hidden: true },
      ],
    });
    expect(screen.getByRole('button', { name: /Shown/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Hidden Action/i })).toBeNull();
  });

  it('emits a toolbar role with aria-label when actions render', () => {
    renderHeader({
      type: 'page:header',
      actions: [{ name: 'a', label: 'A' }],
    });
    const bar = screen.getByRole('toolbar', { name: /Page header actions/i });
    expect(bar).toBeTruthy();
  });

  it('falls back to the data-page-actions-slot div when no actions provided', () => {
    const { container } = renderHeader({
      type: 'page:header',
      title: 'Empty',
    });
    expect(container.querySelector('[data-page-actions-slot]')).toBeTruthy();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('invokes onClick when an action button is clicked', () => {
    const onClick = vi.fn();
    renderHeader({
      type: 'page:header',
      actions: [{ name: 'a', label: 'Click Me', onClick }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Click Me/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

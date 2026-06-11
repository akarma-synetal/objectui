/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Tests for the drill-down protocol helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SpecReport } from '@object-ui/types';
import { ActionRunner } from '@object-ui/core';
import {
  buildDrillAction,
  createDrillHandler,
  registerDrillHandler,
  isDrillAction,
} from '../drill';

/**
 * Pre-9.0 ("query-form") report fixture. Spec 9.0 reports are dataset-bound
 * (`dataset` + `rows`/`values` name arrays), so the inline `objectName` /
 * `columns` / `groupingsDown` shape can no longer pass `SpecReport.create` —
 * but the drill helpers keep a passthrough path for stored pre-9.0 JSON,
 * which is exactly what these tests cover.
 */
function legacyReport(r: Record<string, unknown>): SpecReport {
  return r as unknown as SpecReport;
}

describe('buildDrillAction', () => {
  const baseReport = legacyReport({
    name: 'sales_by_region',
    label: 'Sales by Region',
    objectName: 'opportunity',
    type: 'summary',
    groupingsDown: [{ field: 'region' }],
    columns: [{ field: 'amount', aggregate: 'sum' }],
  });

  it('produces a serializable drill action', () => {
    const drill = buildDrillAction(baseReport, { region: 'East' });
    expect(drill).toMatchObject({
      type: 'drill',
      objectName: 'opportunity',
      view: 'list',
      openIn: 'current',
      filter: { region: 'East' },
    });
    // Round-trip through JSON to prove serializability.
    expect(JSON.parse(JSON.stringify(drill))).toEqual(drill);
  });

  it('merges report.filter + runtimeFilter + groupKey via $and', () => {
    const report = legacyReport({
      ...baseReport,
      filter: { stage: 'closed' },
    });
    const drill = buildDrillAction(
      report,
      { region: 'East' },
      { runtimeFilter: { fiscal_year: 2024 } },
    );
    expect(drill.filter).toEqual({
      $and: [
        { $and: [{ stage: 'closed' }, { fiscal_year: 2024 }] },
        { region: 'East' },
      ],
    });
  });

  it('omits filter when groupKey is empty and no base/runtime filter', () => {
    const drill = buildDrillAction(baseReport, {});
    expect(drill.filter).toBeUndefined();
  });

  it('honours view/recordId/openIn overrides', () => {
    const drill = buildDrillAction(
      baseReport,
      {},
      { view: 'detail', recordId: 42, openIn: 'modal' },
    );
    expect(drill.view).toBe('detail');
    expect(drill.recordId).toBe(42);
    expect(drill.openIn).toBe('modal');
  });
});

describe('isDrillAction', () => {
  it('recognises drill actions', () => {
    expect(isDrillAction({ type: 'drill', objectName: 'x' } as never)).toBe(true);
  });
  it('rejects other action types', () => {
    expect(isDrillAction({ type: 'navigate' } as never)).toBe(false);
    expect(isDrillAction({} as never)).toBe(false);
    expect(isDrillAction(null)).toBe(false);
    expect(isDrillAction(undefined)).toBe(false);
  });
});

describe('createDrillHandler', () => {
  it('invokes navigate with the resolved target', async () => {
    const navigate = vi.fn();
    const handler = createDrillHandler({ navigate });
    const result = await handler(
      {
        type: 'drill',
        objectName: 'lead',
        filter: { source: 'web' },
        view: 'list',
        openIn: 'current',
      } as never,
      {} as never,
    );
    expect(result.success).toBe(true);
    expect(navigate).toHaveBeenCalledWith({
      objectName: 'lead',
      filter: { source: 'web' },
      view: 'list',
      recordId: undefined,
      openIn: 'current',
    });
  });

  it('fails gracefully when called with a non-drill action', async () => {
    const navigate = vi.fn();
    const handler = createDrillHandler({ navigate });
    const result = await handler({ type: 'navigate' } as never, {} as never);
    expect(result.success).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns success=false when navigate throws', async () => {
    const handler = createDrillHandler({
      navigate: () => {
        throw new Error('router crashed');
      },
    });
    const result = await handler(
      { type: 'drill', objectName: 'x' } as never,
      {} as never,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('router crashed');
  });
});

describe('registerDrillHandler', () => {
  it('registers and unregisters the handler on an ActionRunner', async () => {
    const runner = new ActionRunner({});
    const navigate = vi.fn();
    const unregister = registerDrillHandler(runner, { navigate });

    await runner.execute({
      type: 'drill',
      objectName: 'opportunity',
      filter: { region: 'West' },
    } as never);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
      objectName: 'opportunity',
      filter: { region: 'West' },
    }));

    unregister();
    // After unregistration, the drill type no longer routes through our handler.
    navigate.mockClear();
    const res = await runner.execute({
      type: 'drill',
      objectName: 'opportunity',
    } as never);
    expect(navigate).not.toHaveBeenCalled();
    // The runner falls back to its built-in dispatcher which doesn't know
    // about 'drill' — the call should not crash, but it also won't navigate.
    expect(res).toBeDefined();
  });
});

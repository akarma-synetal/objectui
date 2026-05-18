/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Tests for the Spec Report bridge:
 * - Re-exports compile and match the spec shape.
 * - Aggregate mapping handles the `unique → count_distinct` translation.
 * - The presentation adapter is lossy but well-behaved.
 */

import { describe, it, expect } from 'vitest';
import {
  SpecReport,
  SpecReportSchema,
  mapAggregateToQL,
  specReportToPresentation,
  isSpecReport,
} from '../spec-report';
import type { SpecReportInput } from '../spec-report';

describe('SpecReport bridge', () => {
  describe('mapAggregateToQL', () => {
    it('translates unique to count_distinct', () => {
      expect(mapAggregateToQL('unique')).toBe('count_distinct');
    });

    it('passes through standard aggregates', () => {
      expect(mapAggregateToQL('sum')).toBe('sum');
      expect(mapAggregateToQL('avg')).toBe('avg');
      expect(mapAggregateToQL('min')).toBe('min');
      expect(mapAggregateToQL('max')).toBe('max');
      expect(mapAggregateToQL('count')).toBe('count');
    });
  });

  describe('SpecReportSchema parsing', () => {
    it('accepts a minimal tabular report', () => {
      const input: SpecReportInput = {
        name: 'sales_dump',
        label: 'Sales Dump',
        objectName: 'opportunity',
        columns: [{ field: 'name' }, { field: 'amount' }],
      };
      const parsed = SpecReport.create(input);
      expect(parsed.name).toBe('sales_dump');
      expect(parsed.type).toBe('tabular'); // default
      expect(parsed.columns).toHaveLength(2);
    });

    it('accepts a summary report with groupings and aggregates', () => {
      const input: SpecReportInput = {
        name: 'sales_by_owner',
        label: 'Sales by Owner',
        objectName: 'opportunity',
        type: 'summary',
        columns: [
          { field: 'owner_id' },
          { field: 'amount', aggregate: 'sum' },
          { field: 'id', aggregate: 'unique' },
        ],
        groupingsDown: [{ field: 'owner_id' }],
      };
      const parsed = SpecReportSchema.parse(input);
      expect(parsed.type).toBe('summary');
      expect(parsed.groupingsDown).toHaveLength(1);
      expect(parsed.columns[1].aggregate).toBe('sum');
    });
  });

  describe('specReportToPresentation adapter', () => {
    it('extracts string labels from I18nLabel objects', () => {
      const report = SpecReport.create({
        name: 'demo',
        label: 'Demo Report',
        description: 'A short description',
        objectName: 'lead',
        columns: [{ field: 'email', label: 'E-mail' }],
      });
      const legacy = specReportToPresentation(report);
      expect(legacy.type).toBe('report');
      expect(legacy.title).toBe('Demo Report');
      expect(legacy.description).toBe('A short description');
      expect(legacy.fields?.[0].label).toBe('E-mail');
    });

    it('maps unique aggregate to legacy distinct', () => {
      const report = SpecReport.create({
        name: 'distinct_demo',
        label: 'Distinct Demo',
        objectName: 'account',
        columns: [{ field: 'id', aggregate: 'unique' }],
      });
      const legacy = specReportToPresentation(report);
      expect(legacy.fields?.[0].aggregation).toBe('distinct');
    });

    it('collapses joined report type to tabular for legacy renderer', () => {
      const report = SpecReport.create({
        name: 'joined_demo',
        label: 'Joined',
        objectName: 'account',
        type: 'joined',
        columns: [{ field: 'name' }],
      });
      const legacy = specReportToPresentation(report);
      expect(legacy.reportType).toBe('tabular');
    });

    it('preserves matrix report type', () => {
      const report = SpecReport.create({
        name: 'matrix_demo',
        label: 'Matrix',
        objectName: 'opportunity',
        type: 'matrix',
        columns: [{ field: 'amount', aggregate: 'sum' }],
        groupingsDown: [{ field: 'region' }],
        groupingsAcross: [{ field: 'quarter' }],
      });
      const legacy = specReportToPresentation(report);
      expect(legacy.reportType).toBe('matrix');
      // groupingsAcross is intentionally lost in the legacy projection.
      expect(legacy.groupBy?.[0].field).toBe('region');
    });

    it('preserves dateGranularity on groupings', () => {
      const report = SpecReport.create({
        name: 'time_demo',
        label: 'Time',
        objectName: 'order',
        type: 'summary',
        columns: [{ field: 'amount', aggregate: 'sum' }],
        groupingsDown: [{ field: 'close_date', dateGranularity: 'quarter' }],
      });
      const legacy = specReportToPresentation(report);
      expect(legacy.groupBy?.[0].dateGranularity).toBe('quarter');
    });

    it('omits groupBy when no groupings present', () => {
      const report = SpecReport.create({
        name: 'plain',
        label: 'Plain',
        objectName: 'account',
        columns: [{ field: 'name' }],
      });
      const legacy = specReportToPresentation(report);
      expect(legacy.groupBy).toBeUndefined();
    });
  });

  describe('isSpecReport type guard', () => {
    it('recognises a spec report', () => {
      const report = SpecReport.create({
        name: 'r1',
        label: 'Report A',
        objectName: 'account',
        columns: [{ field: 'name' }],
      });
      expect(isSpecReport(report)).toBe(true);
    });

    it('rejects a legacy presentation report', () => {
      const legacy = {
        type: 'report',
        title: 'Old',
        fields: [{ name: 'x' }],
      };
      expect(isSpecReport(legacy)).toBe(false);
    });

    it('rejects random objects', () => {
      expect(isSpecReport(null)).toBe(false);
      expect(isSpecReport(undefined)).toBe(false);
      expect(isSpecReport({})).toBe(false);
      expect(isSpecReport('string')).toBe(false);
    });
  });
});

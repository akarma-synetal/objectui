/**
 * SpecReportGrid stories — CRM-flavoured demos for M1.
 *
 * - Sales funnel by stage (summary report, sum amount, count opportunities)
 * - Sales funnel by owner → stage (multi-level grouping)
 * - Pipeline by region × quarter (matrix placeholder — M2 will render this)
 *
 * Stories supply rows inline so they work without a backend; the drill action
 * is wired to a console-logging ActionRunner so clicks demonstrate the
 * declarative drill protocol.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ActionRunner } from '@object-ui/core';
import type { SpecReport } from '@object-ui/types';
import { SpecReportGrid } from './SpecReportGrid';
import { registerDrillHandler, type DrillNavigateTarget } from './drill';

const meta = {
  title: 'Plugins/Report/SpecReportGrid',
  component: SpecReportGrid,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof SpecReportGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const opportunities = [
  { id: 'O1', name: 'Acme renewal', owner: 'alice', stage: 'qualified', region: 'EMEA', closeQuarter: '2024-Q1', amount: 12000 },
  { id: 'O2', name: 'Beta upgrade',  owner: 'alice', stage: 'qualified', region: 'EMEA', closeQuarter: '2024-Q2', amount: 8000 },
  { id: 'O3', name: 'Gamma deal',    owner: 'alice', stage: 'proposal',  region: 'AMER', closeQuarter: '2024-Q1', amount: 25000 },
  { id: 'O4', name: 'Delta SaaS',    owner: 'bob',   stage: 'proposal',  region: 'AMER', closeQuarter: '2024-Q2', amount: 40000 },
  { id: 'O5', name: 'Epsilon migr.', owner: 'bob',   stage: 'won',       region: 'APAC', closeQuarter: '2024-Q1', amount: 60000 },
  { id: 'O6', name: 'Zeta launch',   owner: 'bob',   stage: 'won',       region: 'APAC', closeQuarter: '2024-Q2', amount: 35000 },
  { id: 'O7', name: 'Eta platform',  owner: 'carol', stage: 'qualified', region: 'AMER', closeQuarter: '2024-Q3', amount: 18000 },
  { id: 'O8', name: 'Theta retain',  owner: 'carol', stage: 'lost',      region: 'EMEA', closeQuarter: '2024-Q3', amount: 5000 },
];

function makeRunner() {
  const runner = new ActionRunner();
  registerDrillHandler(runner, {
    navigate: (target: DrillNavigateTarget) => {
      // eslint-disable-next-line no-console
      console.log('[drill] navigate →', target);
    },
  });
  return runner;
}

/** Funnel by stage — classic CRM "summary by status" view. */
export const FunnelByStage: Story = {
  render: () => {
    const report: SpecReport = {
      name: 'opp_funnel_by_stage',
      objectName: 'opportunity',
      type: 'summary',
      groupingsDown: [{ field: 'stage' }],
      columns: [
        { field: 'amount', aggregate: 'sum', label: 'Pipeline $' },
        { field: 'id', aggregate: 'count', label: '# Deals' },
        { field: 'owner', aggregate: 'unique', label: '# Owners' },
      ],
    };
    return (
      <SpecReportGrid
        report={report}
        rows={opportunities}
        actionRunner={makeRunner()}
        drillView="list"
        drillOpenIn="modal"
      />
    );
  },
};

/** Two-level funnel: owner → stage. Click a row to dispatch a drill action. */
export const FunnelByOwnerAndStage: Story = {
  render: () => {
    const report: SpecReport = {
      name: 'opp_funnel_by_owner_stage',
      objectName: 'opportunity',
      type: 'summary',
      groupingsDown: [{ field: 'owner' }, { field: 'stage' }],
      columns: [
        { field: 'amount', aggregate: 'sum', label: 'Pipeline $' },
        { field: 'amount', aggregate: 'avg', label: 'Avg Deal $' },
        { field: 'id', aggregate: 'count', label: '# Deals' },
      ],
    };
    return (
      <SpecReportGrid
        report={report}
        rows={opportunities}
        actionRunner={makeRunner()}
      />
    );
  },
};

/** Tabular detail report — flat opportunity list with totals. */
export const TabularOpportunityList: Story = {
  render: () => {
    const report: SpecReport = {
      name: 'opp_list',
      objectName: 'opportunity',
      type: 'tabular',
      columns: [
        { field: 'name', label: 'Opportunity' },
        { field: 'owner', label: 'Owner' },
        { field: 'stage', label: 'Stage' },
        { field: 'amount', label: 'Amount' },
      ],
    };
    return <SpecReportGrid report={report} rows={opportunities} />;
  },
};

/** Matrix report placeholder — region × quarter pivot will land in M2. */
export const MatrixRegionByQuarter: Story = {
  render: () => {
    const report: SpecReport = {
      name: 'opp_matrix_region_quarter',
      objectName: 'opportunity',
      type: 'matrix',
      groupingsDown: [{ field: 'region' }],
      groupingsAcross: [{ field: 'closeQuarter' }],
      columns: [{ field: 'amount', aggregate: 'sum', label: 'Pipeline $' }],
    };
    return <SpecReportGrid report={report} rows={opportunities} />;
  },
};

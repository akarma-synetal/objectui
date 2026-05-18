/**
 * MatrixRenderer stories — region × quarter pivot for M2 demo.
 *
 * Showcases:
 *  - `groupingsAcross` rendering as columns
 *  - `dateGranularity: 'quarter'` bucketing on close_date
 *  - Server-side aggregation path: stories supply a mock `dataSource.aggregate`
 *    that returns pre-bucketed rows so the hook skips client aggregation,
 *    mirroring what objectql's engine fallback now does end-to-end.
 *  - Cell click → drill action with combined (region, quarter) filter.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ActionRunner } from '@object-ui/core';
import type { SpecReport } from '@object-ui/types';
import { MatrixRenderer } from './MatrixRenderer';
import { useReportData } from './hooks/useReportData';
import { registerDrillHandler, type DrillNavigateTarget } from './drill';

const meta = {
  title: 'Plugins/Report/MatrixRenderer',
  component: MatrixRenderer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof MatrixRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

function makeRunner() {
  const runner = new ActionRunner();
  const navigate = (target: DrillNavigateTarget) => {
    // eslint-disable-next-line no-console
    console.log('[drill]', target);
  };
  registerDrillHandler(runner, { navigate });
  return runner;
}

/**
 * Mock dataSource that simulates the framework's `engine.aggregate()` having
 * already grouped + bucketed rows server-side. Returned shape: one row per
 * (region × quarter) carrying `amount__sum` with the pre-computed total.
 */
const mockServerAggregateDataSource = {
  find: async () => [],
  aggregate: async (
    _object: string,
    _query: { groupBy?: unknown; aggregations?: unknown },
  ) => [
    { region: 'AMER', quarter: '2024-Q1', amount__sum: 25000 },
    { region: 'AMER', quarter: '2024-Q2', amount__sum: 40000 },
    { region: 'AMER', quarter: '2024-Q3', amount__sum: 18000 },
    { region: 'EMEA', quarter: '2024-Q1', amount__sum: 12000 },
    { region: 'EMEA', quarter: '2024-Q2', amount__sum: 8000 },
    { region: 'EMEA', quarter: '2024-Q3', amount__sum: 5000 },
    { region: 'APAC', quarter: '2024-Q1', amount__sum: 60000 },
    { region: 'APAC', quarter: '2024-Q2', amount__sum: 35000 },
  ],
};

const regionByQuarterReport: SpecReport = {
  name: 'pipeline_region_x_quarter',
  label: 'Pipeline by region × quarter',
  description: 'Closed-won amount, regions down × close-quarter across.',
  objectName: 'opportunity',
  type: 'matrix',
  groupingsDown: [{ field: 'region' }],
  // dateGranularity on the across axis is what the engine fallback /
  // structured GroupByNode now supports end-to-end.
  groupingsAcross: [{ field: 'close_date', dateGranularity: 'quarter' }],
  columns: [
    { field: 'amount', aggregate: 'sum', label: 'Closed Amount', format: 'currency' },
  ],
};

function StoryHost({ report, runner }: { report: SpecReport; runner: ActionRunner }) {
  const { pivot } = useReportData(report, { dataSource: mockServerAggregateDataSource });
  if (!pivot) {
    return <div className="text-sm text-muted-foreground">Loading server-aggregated matrix…</div>;
  }
  return (
    <MatrixRenderer
      pivot={pivot}
      report={report}
      actionRunner={runner}
      onCellClick={(cell) => {
        // eslint-disable-next-line no-console
        console.log('[matrix-cell]', cell);
      }}
    />
  );
}

export const RegionByQuarterServerAggregated: Story = {
  name: 'Region × Quarter (server-aggregated)',
  args: { pivot: {} as never, report: regionByQuarterReport },
  render: () => {
    const runner = React.useMemo(() => makeRunner(), []);
    // Note: the quarter column header here shows the value coming straight
    // from the server (e.g. "2024-Q1"). When the driver/SQL gains real
    // DATE_TRUNC emission, the engine will continue to project the same
    // bucket strings via the in-memory fallback — clients don't have to know.
    return (
      <div className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          This story wires a mock <code>dataSource.aggregate()</code> returning
          pre-bucketed rows. <code>useReportData</code> detects it and skips
          client aggregation — the same path taken when the real ObjectQL
          engine receives a structured <code>groupBy</code> with{' '}
          <code>dateGranularity</code>.
        </div>
        <StoryHost report={regionByQuarterReport} runner={runner} />
      </div>
    );
  },
};

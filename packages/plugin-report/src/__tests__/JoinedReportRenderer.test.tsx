/**
 * JoinedReportRenderer tests.
 *
 * Covers:
 *  - Vertical stack of blocks
 *  - Block label / description rendering
 *  - Outer (joined-level) filter inherited into each block via $and
 *  - Block filter wins on key collisions (it's the more specific constraint)
 *  - Drill propagation: actionRunner/drillView flow to every block
 *  - Defensive: missing `blocks` array renders the invalid notice
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JoinedReportRenderer } from '../JoinedReportRenderer';
import type { JoinedSpecReport, SpecReport } from '@object-ui/types';

// Capture what schemas each block ReportRenderer sees so we can assert
// filter inheritance + drill propagation without spinning up real data hooks.
const capturedSchemas: Array<SpecReport> = [];
const capturedProps: Array<Record<string, unknown>> = [];

vi.mock('../ReportRenderer', () => ({
  ReportRenderer: (props: Record<string, unknown>) => {
    const schema = props.schema as SpecReport;
    capturedSchemas.push(schema);
    capturedProps.push(props);
    return <div data-testid="rr-stub" data-name={schema.name}>{schema.name}</div>;
  },
}));

function makeBlock(name: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    name,
    type: 'tabular' as const,
    columns: [{ field: 'amount' }],
    ...extra,
  };
}

describe('JoinedReportRenderer', () => {
  beforeEach(() => {
    capturedSchemas.length = 0;
    capturedProps.length = 0;
  });

  it('renders an invalid notice when blocks are missing', () => {
    render(
      <JoinedReportRenderer
        report={{
          name: 'bad',
          objectName: 'x',
          type: 'joined',
          columns: [],
        } as unknown as JoinedSpecReport}
      />,
    );
    expect(screen.getByTestId('joined-report-invalid')).toBeInTheDocument();
  });

  it('renders one block per entry with label + description', () => {
    const joined: JoinedSpecReport = {
      name: 'churn_signals',
      objectName: 'account',
      type: 'joined',
      columns: [],
      blocks: [
        makeBlock('new_customers', { label: 'New customers', description: 'Last 30 days' }),
        makeBlock('churned', { label: 'Churned' }),
      ],
    } as JoinedSpecReport;

    render(<JoinedReportRenderer report={joined} />);

    const blocks = screen.getAllByTestId('joined-report-block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveAttribute('data-block-id', 'new_customers');
    expect(blocks[1]).toHaveAttribute('data-block-id', 'churned');
    expect(screen.getByText('New customers')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Churned')).toBeInTheDocument();
    expect(capturedSchemas.map((s) => s.name)).toEqual(['new_customers', 'churned']);
  });

  it('merges the joined-level filter into every block via $and and inherits container objectName', () => {
    const outer = { owner_id: 'me' };
    const blockFilter = { stage: { $in: ['won', 'lost'] } };

    const joined: JoinedSpecReport = {
      name: 'with_filter',
      objectName: 'account',
      type: 'joined',
      columns: [],
      filter: outer,
      blocks: [
        makeBlock('a'),                                    // no own filter, no own objectName
        makeBlock('b', { filter: blockFilter, objectName: 'opportunity' }),
      ],
    } as JoinedSpecReport;

    render(<JoinedReportRenderer report={joined} />);

    // Block A: outer-only after merge, inherits container objectName.
    expect(capturedSchemas[0].filter).toEqual(outer);
    expect(capturedSchemas[0].objectName).toBe('account');
    // Block B: $and({owner_id: 'me'}, {stage: ...}) and its own objectName.
    expect(capturedSchemas[1].filter).toEqual({ $and: [outer, blockFilter] });
    expect(capturedSchemas[1].objectName).toBe('opportunity');
  });

  it('passes actionRunner, dataSource and drill props to every block', () => {
    const dataSource = { find: vi.fn(), aggregate: vi.fn() } as unknown as Record<string, unknown>;
    const actionRunner = vi.fn() as any;
    const joined: JoinedSpecReport = {
      name: 'with_drill',
      objectName: 'account',
      type: 'joined',
      columns: [],
      blocks: [makeBlock('one'), makeBlock('two')],
    } as JoinedSpecReport;

    render(
      <JoinedReportRenderer
        report={joined}
        dataSource={dataSource as any}
        actionRunner={actionRunner}
        drillView="grid"
        drillOpenIn="modal"
        runtimeFilter={{ region: 'APAC' }}
      />,
    );

    for (const props of capturedProps) {
      expect(props.dataSource).toBe(dataSource);
      expect(props.actionRunner).toBe(actionRunner);
      expect(props.drillView).toBe('grid');
      expect(props.drillOpenIn).toBe('modal');
      expect(props.runtimeFilter).toEqual({ region: 'APAC' });
    }
  });

  it('falls back to block.name when block label is missing', () => {
    const joined: JoinedSpecReport = {
      name: 'no_labels',
      objectName: 'account',
      type: 'joined',
      columns: [],
      blocks: [makeBlock('unnamed_block')],
    } as JoinedSpecReport;

    render(<JoinedReportRenderer report={joined} />);
    const block = screen.getByTestId('joined-report-block');
    expect(block.querySelector('h3')).toHaveTextContent('unnamed_block');
  });
});

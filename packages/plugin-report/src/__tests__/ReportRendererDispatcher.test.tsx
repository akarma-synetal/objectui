/**
 * ReportRenderer dispatcher tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportRenderer } from '../ReportRenderer';
import type { SpecReport } from '@object-ui/types';

vi.mock('../SpecReportGrid', () => ({
  SpecReportGrid: (props: { report: SpecReport }) => (
    <div data-testid="spec-report-grid-stub">{props.report.name}</div>
  ),
}));

vi.mock('../MatrixRenderer', () => ({
  MatrixRenderer: (props: { report: SpecReport }) => (
    <div data-testid="matrix-renderer-stub">{props.report.name}</div>
  ),
}));

vi.mock('../LegacyReportRenderer', () => ({
  LegacyReportRenderer: (props: { schema: { title?: string } }) => (
    <div data-testid="legacy-renderer-stub">{props.schema.title}</div>
  ),
}));

const baseSpec: SpecReport = {
  name: 'spec_report',
  objectName: 'opportunity',
  type: 'tabular',
  columns: [{ field: 'amount' }],
};

describe('ReportRenderer dispatcher', () => {
  it('routes spec tabular reports to SpecReportGrid', () => {
    render(<ReportRenderer schema={baseSpec} rows={[]} />);
    expect(screen.getByTestId('spec-report-grid-stub')).toHaveTextContent('spec_report');
  });

  it('routes spec summary reports to SpecReportGrid', () => {
    render(
      <ReportRenderer
        schema={{ ...baseSpec, type: 'summary', groupingsDown: [{ field: 'stage' }] }}
        rows={[]}
      />,
    );
    expect(screen.getByTestId('spec-report-grid-stub')).toBeInTheDocument();
  });

  it('routes spec matrix reports to MatrixRenderer', () => {
    render(<ReportRenderer schema={{ ...baseSpec, type: 'matrix', groupingsAcross: [{ field: 'q' }] }} rows={[]} />);
    expect(screen.getByTestId('matrix-renderer-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('spec-report-grid-stub')).not.toBeInTheDocument();
  });

  it('shows joined placeholder for spec joined reports', () => {
    render(<ReportRenderer schema={{ ...baseSpec, type: 'joined' }} rows={[]} />);
    expect(screen.getByTestId('report-joined-placeholder')).toBeInTheDocument();
  });

  it('falls back to LegacyReportRenderer for non-spec schemas', () => {
    render(
      <ReportRenderer
        schema={{ type: 'report', title: 'My Old Report', data: [], columns: [] }}
      />,
    );
    expect(screen.getByTestId('legacy-renderer-stub')).toHaveTextContent('My Old Report');
    expect(screen.queryByTestId('spec-report-grid-stub')).not.toBeInTheDocument();
  });

  it('defaults missing report.type to tabular', () => {
    const noType = { ...baseSpec };
    delete (noType as Partial<SpecReport>).type;
    render(<ReportRenderer schema={noType as SpecReport} rows={[]} />);
    expect(screen.getByTestId('spec-report-grid-stub')).toBeInTheDocument();
  });
});

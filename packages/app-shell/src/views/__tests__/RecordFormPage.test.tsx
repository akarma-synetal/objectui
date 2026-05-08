/**
 * RecordFormPage tests
 *
 * Verifies the page-mode create/edit route behavior:
 *   - resolves the object definition from `useMetadata()`
 *   - renders the create form when no `recordId` is in the URL
 *   - renders the edit form (with the right `recordId` / `mode`) when the
 *     URL has a `:recordId` segment
 *   - "Object Not Found" empty state shows when metadata has no matching
 *     definition (and metadata loading has finished)
 *   - back button navigates back
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecordFormPage } from '../RecordFormPage';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { metadataState } = vi.hoisted(() => ({
  metadataState: { loading: false, objects: [] as any[] },
}));

vi.mock('../../providers/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: metadataState.objects,
    dashboards: [],
    reports: [],
    pages: [],
    loading: metadataState.loading,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../providers/AdapterProvider', () => ({
  useAdapter: () => ({
    findOne: vi.fn().mockResolvedValue({ id: 'r1', name: 'Acme' }),
    create: vi.fn().mockResolvedValue({ id: 'r2' }),
    update: vi.fn().mockResolvedValue({ id: 'r1' }),
  }),
}));

vi.mock('../../providers/ExpressionProvider', () => ({
  ExpressionProvider: ({ children }: any) => <>{children}</>,
  evaluateVisibility: () => true,
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@example.com', role: 'user' },
  }),
}));

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue ?? key,
  }),
  useObjectLabel: () => ({
    objectLabel: (def: any) => def?.label ?? def?.name ?? '',
  }),
}));

// Stub <ObjectForm> — exposing the schema we feed it so we can assert
// mode / recordId / objectName flow through correctly without exercising
// the full plugin-form pipeline.
vi.mock('@object-ui/plugin-form', () => ({
  ObjectForm: ({ schema }: any) => (
    <div
      data-testid="object-form"
      data-mode={schema.mode}
      data-object-name={schema.objectName}
      data-record-id={schema.recordId ?? ''}
      data-form-type={schema.formType}
    >
      <button data-testid="form-success" onClick={() => schema.onSuccess?.({})}>
        Submit
      </button>
      <button data-testid="form-cancel" onClick={() => schema.onCancel?.()}>
        Cancel
      </button>
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/apps/:appName/:objectName/new"
          element={<RecordFormPage mode="create" />}
        />
        <Route
          path="/apps/:appName/:objectName/record/:recordId/edit"
          element={<RecordFormPage mode="edit" />}
        />
        <Route
          path="/apps/:appName/:objectName"
          element={<div data-testid="object-list-page" />}
        />
        <Route
          path="/apps/:appName/:objectName/record/:recordId"
          element={<div data-testid="record-detail-page" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const accountObject = {
  name: 'account',
  label: 'Account',
  fields: {
    name: { type: 'text', label: 'Name' },
    industry: { type: 'text', label: 'Industry' },
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RecordFormPage', () => {
  beforeEach(() => {
    metadataState.loading = false;
    metadataState.objects = [accountObject];
  });

  it('renders the create form when navigated to /:objectName/new', () => {
    renderAt('/apps/sales/account/new');

    const page = screen.getByTestId('record-form-page');
    expect(page).toHaveAttribute('data-mode', 'create');

    const form = screen.getByTestId('object-form');
    expect(form).toHaveAttribute('data-mode', 'create');
    expect(form).toHaveAttribute('data-object-name', 'account');
    expect(form).toHaveAttribute('data-record-id', '');
    expect(form).toHaveAttribute('data-form-type', 'simple');
  });

  it('renders the edit form with the URL record id', () => {
    renderAt('/apps/sales/account/record/abc-123/edit');

    const form = screen.getByTestId('object-form');
    expect(form).toHaveAttribute('data-mode', 'edit');
    expect(form).toHaveAttribute('data-object-name', 'account');
    expect(form).toHaveAttribute('data-record-id', 'abc-123');
  });

  it('shows the Object Not Found empty state for an unknown object', () => {
    metadataState.objects = [];
    renderAt('/apps/sales/unknown/new');

    expect(screen.queryByTestId('object-form')).not.toBeInTheDocument();
    expect(screen.getByText(/Object Not Found/i)).toBeInTheDocument();
  });

  it('renders the loading skeleton while metadata is loading', () => {
    metadataState.loading = true;
    metadataState.objects = [];
    renderAt('/apps/sales/account/new');

    // Skeleton renders no form and no empty state
    expect(screen.queryByTestId('object-form')).not.toBeInTheDocument();
    expect(screen.queryByText(/Object Not Found/i)).not.toBeInTheDocument();
  });

  it('cancel triggers a back-navigation handler', () => {
    renderAt('/apps/sales/account/record/abc-123/edit');

    const cancel = screen.getByTestId('form-cancel');
    // Should not throw when invoked — exact navigation target depends on
    // history length which MemoryRouter sets to the entry array length, and
    // we just want to make sure the wiring is in place.
    fireEvent.click(cancel);
    // After cancel the page falls back to the record detail when there is
    // no history entry; assert we no longer see the form.
    expect(screen.queryByTestId('record-form-page')).not.toBeInTheDocument();
  });

  it('back button is rendered with an accessible label', () => {
    renderAt('/apps/sales/account/new');
    expect(screen.getByTestId('record-form-page-back')).toBeInTheDocument();
  });
});

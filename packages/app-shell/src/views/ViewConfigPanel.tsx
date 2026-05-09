/**
 * ViewConfigPanel — Airtable-style simplified configuration panel.
 *
 * Renders a focused, opinionated set of sections (Page / Data /
 * Appearance / Toolbar / User actions / Navigation / Advanced) — matching
 * Airtable's Interface designer right rail. Power-user sections (records,
 * sharing, accessibility) are intentionally excluded to keep the panel
 * approachable; they can be re-introduced later as a dedicated "advanced"
 * settings dialog if needed.
 *
 * All changes are buffered in a local draft state. Clicking Save commits
 * the draft via onSave; Discard resets to the original activeView.
 */

import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { ConfigPanelRenderer, useConfigDraft, Button } from '@object-ui/components';
import { Settings2 } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  buildViewConfigSchema,
  deriveFieldOptions,
  toFilterGroup,
  toSortItems,
  VIEW_TYPE_LABELS,
} from '@object-ui/plugin-view';

/** Editor panel types that can be opened from clickable rows */
export type EditorPanelType = 'columns' | 'filter' | 'sort';

export interface ViewConfigPanelProps {
    /** Whether the panel is open */
    open: boolean;
    /** Close callback */
    onClose: () => void;
    /** Panel mode: "edit" for existing views, "create" for new views */
    mode?: 'create' | 'edit';
    /** The active view definition */
    activeView: {
        id: string;
        label?: string;
        type?: string;
        columns?: string[];
        filter?: any[];
        sort?: any[];
        description?: string;
        showSearch?: boolean;
        showFilters?: boolean;
        showSort?: boolean;
        allowExport?: boolean;
        showDescription?: boolean;
        addRecordViaForm?: boolean;
        exportOptions?: any;
        [key: string]: any;
    };
    /** The object definition */
    objectDef: {
        name: string;
        label?: string;
        description?: string;
        fields?: Record<string, any>;
        [key: string]: any;
    };
    /** Optional record count to display */
    recordCount?: number;
    /** Called when any view config field changes (local draft update) */
    onViewUpdate?: (field: string, value: any) => void;
    /** Called to persist all draft changes */
    onSave?: (draft: Record<string, any>) => void;
    /** Called when create-mode view is created */
    onCreate?: (config: Record<string, any>) => void;
}

export function ViewConfigPanel({ open, onClose, mode = 'edit', activeView, objectDef, onViewUpdate, onSave, onCreate }: ViewConfigPanelProps) {
    const { t } = useObjectTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

    // "Show advanced settings" — when false (default), the panel only shows
    // the Airtable-essential subset. When true, every section/field is
    // surfaced for power users. Reset whenever the panel closes so reopening
    // returns to the simplified view.
    const [showAdvanced, setShowAdvanced] = useState(false);
    useEffect(() => {
        if (!open) setShowAdvanced(false);
    }, [open]);

    // Default empty view for create mode
    const defaultNewView = useMemo(() => ({
        id: `view_${Date.now()}`,
        label: t('console.objectView.newView'),
        type: 'grid',
        columns: [],
        filter: [],
        sort: [],
        showSearch: true,
        showFilters: true,
        showSort: true,
    }), []); // eslint-disable-line react-hooks/exhaustive-deps

    // Stabilize source reference: only change when view ID changes.
    // This prevents useConfigDraft from resetting on every parent re-render
    // (same behavior as original useEffect with [activeView.id] dependency).
    const stableKey = mode === 'create' ? 'create' : activeView.id;
    const stableActiveView = useMemo(
        () => ({ ...activeView }),
        [stableKey], // eslint-disable-line react-hooks/exhaustive-deps
    );
    const effectiveActiveView = mode === 'create' ? defaultNewView : stableActiveView;

    // Schema-driven draft state management
    const { draft, isDirty, updateField, discard, undo, redo, canUndo, canRedo } = useConfigDraft(effectiveActiveView, {
        mode,
        onUpdate: onViewUpdate,
    });

    // Focus the panel when it opens for keyboard accessibility
    useEffect(() => {
        if (open && panelRef.current) {
            panelRef.current.focus();
        }
    }, [open]);

    // Derive field options from objectDef
    const fieldOptions = useMemo(() => deriveFieldOptions(objectDef), [objectDef.fields]);

    // Bridge: filter/sort → builder format
    const filterGroupValue = useMemo(() => toFilterGroup(draft.filter), [draft.filter]);
    const sortItemsValue = useMemo(() => toSortItems(draft.sort), [draft.sort]);

    // Build schema. essentialOnly is the default; the user can opt-in to the
    // full advanced surface via the "Show advanced settings" toggle below.
    const schema = useMemo(
        () => buildViewConfigSchema({
            t,
            fieldOptions,
            objectDef,
            updateField,
            filterGroupValue,
            sortItemsValue,
            essentialOnly: !showAdvanced,
        }),
        [t, fieldOptions, objectDef, updateField, filterGroupValue, sortItemsValue, showAdvanced],
    );

    // Override breadcrumb with dynamic view type
    const viewType = draft.type || 'grid';
    const dynamicSchema = useMemo(() => ({
        ...schema,
        breadcrumb: [t('console.objectView.page'), VIEW_TYPE_LABELS[viewType] || viewType],
    }), [schema, t, viewType]);

    // Save/discard handlers with create mode support
    const handleSave = useCallback(() => {
        if (mode === 'create') {
            onCreate?.(draft);
        } else {
            onSave?.(draft);
        }
        // Clear dirty state after save while preserving draft values
        discard();
    }, [draft, onSave, onCreate, mode, discard]);

    const handleDiscard = useCallback(() => {
        if (mode === 'create') {
            onClose();
            return;
        }
        discard();
    }, [discard, mode, onClose]);

    const panelTitle = mode === 'create'
        ? t('console.objectView.createView')
        : t('console.objectView.configureView');

    // Header-extra: "Show advanced" toggle button. Subtle gear icon button
    // sitting next to undo/redo/close — clearly affordant but not visually
    // dominant. Title swaps between "Show advanced settings" and "Show fewer
    // settings" so the user always knows what the next click will do.
    const advancedToggle = (
        <Button
            size="sm"
            variant={showAdvanced ? 'secondary' : 'ghost'}
            onClick={() => setShowAdvanced(v => !v)}
            className="h-7 w-7 p-0"
            data-testid="view-config-advanced-toggle"
            aria-pressed={showAdvanced}
            title={
                showAdvanced
                    ? t('console.objectView.showFewerSettings', { defaultValue: 'Show fewer settings' })
                    : t('console.objectView.showAdvancedSettings', { defaultValue: 'Show advanced settings' })
            }
        >
            <Settings2 className="h-3.5 w-3.5" />
        </Button>
    );

    return (
        <ConfigPanelRenderer
            open={open}
            onClose={onClose}
            schema={dynamicSchema}
            draft={draft}
            isDirty={isDirty}
            onFieldChange={updateField}
            onSave={handleSave}
            onDiscard={handleDiscard}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            undoLabel={t('designer.undo')}
            redoLabel={t('designer.redo')}
            objectDef={objectDef}
            saveLabel={t('console.objectView.save')}
            discardLabel={t('console.objectView.discard')}
            panelRef={panelRef}
            role="complementary"
            ariaLabel={panelTitle}
            tabIndex={-1}
            testId="view-config-panel"
            closeTitle={t('console.objectView.closePanel')}
            footerTestId="view-config-footer"
            saveTestId="view-config-save"
            discardTestId="view-config-discard"
            headerExtra={advancedToggle}
            className="transition-all overflow-hidden"
        />
    );
}

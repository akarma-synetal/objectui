/**
 * ViewConfigPanel — Schema-Driven
 *
 * Airtable-style right-side configuration panel for inline view editing.
 * Migrated to Schema-Driven architecture using ConfigPanelRenderer +
 * useConfigDraft, replacing ~1600 lines of imperative code with a
 * declarative schema factory.
 *
 * All changes are buffered in a local draft state. Clicking Save commits
 * the draft via onSave; Discard resets to the original activeView.
 */

import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { ConfigPanelRenderer, useConfigDraft, Button } from '@object-ui/components';
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
    /**
     * Initial value for the "essentials only" toggle. When true, advanced
     * sections (navigation, records, export, appearance, user actions,
     * sharing, accessibility) are hidden until the user clicks "Show all
     * properties". Once the user toggles, the choice is persisted in
     * localStorage and overrides this default. Default: false (full schema).
     */
    essentialOnlyDefault?: boolean;
}

export function ViewConfigPanel({ open, onClose, mode = 'edit', activeView, objectDef, onViewUpdate, onSave, onCreate, essentialOnlyDefault = false }: ViewConfigPanelProps) {
    const { t } = useObjectTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

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

    // Essentials-only toggle — defaults to `essentialOnlyDefault` (set by the
    // consumer; app-shell passes true so end users see a focused panel).
    // User clicks on the header toggle persist their choice to localStorage,
    // which then overrides the default on subsequent mounts.
    const PREF_KEY = 'object-ui:view-config-panel:essentialOnly';
    const [essentialOnly, setEssentialOnly] = useState<boolean>(() => {
        try {
            const v = typeof window !== 'undefined' ? window.localStorage.getItem(PREF_KEY) : null;
            return v === null ? essentialOnlyDefault : v === '1';
        } catch {
            return essentialOnlyDefault;
        }
    });
    const [hasUserToggled, setHasUserToggled] = useState(false);
    useEffect(() => {
        if (!hasUserToggled) return;
        try {
            if (typeof window !== 'undefined') window.localStorage.setItem(PREF_KEY, essentialOnly ? '1' : '0');
        } catch { /* ignore */ }
    }, [essentialOnly, hasUserToggled]);

    // Build schema
    const schema = useMemo(
        () => buildViewConfigSchema({
            t,
            fieldOptions,
            objectDef,
            updateField,
            filterGroupValue,
            sortItemsValue,
            essentialOnly,
        }),
        [t, fieldOptions, objectDef, updateField, filterGroupValue, sortItemsValue, essentialOnly],
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
            className="transition-all overflow-hidden"
            headerExtra={
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    data-testid="view-config-toggle-essential"
                    onClick={() => { setEssentialOnly(v => !v); setHasUserToggled(true); }}
                    title={essentialOnly
                        ? t('console.objectView.showAllProperties')
                        : t('console.objectView.showEssentialsOnly')}
                >
                    {essentialOnly
                        ? t('console.objectView.showAllProperties')
                        : t('console.objectView.showEssentialsOnly')}
                </Button>
            }
        />
    );
}

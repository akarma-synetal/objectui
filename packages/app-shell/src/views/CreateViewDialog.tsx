/**
 * CreateViewDialog — Airtable-style "Create new view" modal.
 *
 * Step 1: User picks a view type from a visual grid of cards (icon + label
 * + short description). Selection is highlighted.
 * Step 2: User enters a name (required, defaults to a friendly suggestion
 * like "Grid 1"). The Create button is disabled until a name is provided.
 *
 * On submit, calls `onCreate({ type, label })`. The parent is responsible
 * for actually persisting the view (we keep this component pure — no
 * dataSource coupling).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  cn,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  LayoutGrid,
  KanbanSquare,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  GanttChartSquare,
  Clock,
  Map as MapIcon,
  BarChart3,
} from 'lucide-react';

export interface CreateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (config: { type: string; label: string }) => void;
  /** Used to suggest unique default names like "Grid 2" if "Grid 1" exists. */
  existingLabels?: string[];
  /** Restrict the available view types. Defaults to all built-in types. */
  availableTypes?: string[];
}

interface ViewTypeMeta {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

function buildViewTypeMeta(t: (k: string) => string): ViewTypeMeta[] {
  return [
    { type: 'grid',     icon: LayoutGrid,       label: t('console.objectView.viewTypeGrid'),     description: t('console.objectView.viewTypeGridDesc') },
    { type: 'kanban',   icon: KanbanSquare,     label: t('console.objectView.viewTypeKanban'),   description: t('console.objectView.viewTypeKanbanDesc') },
    { type: 'calendar', icon: CalendarIcon,     label: t('console.objectView.viewTypeCalendar'), description: t('console.objectView.viewTypeCalendarDesc') },
    { type: 'gallery',  icon: ImageIcon,        label: t('console.objectView.viewTypeGallery'),  description: t('console.objectView.viewTypeGalleryDesc') },
    { type: 'timeline', icon: Clock,            label: t('console.objectView.viewTypeTimeline'), description: t('console.objectView.viewTypeTimelineDesc') },
    { type: 'gantt',    icon: GanttChartSquare, label: t('console.objectView.viewTypeGantt'),    description: t('console.objectView.viewTypeGanttDesc') },
    { type: 'map',      icon: MapIcon,          label: t('console.objectView.viewTypeMap'),      description: t('console.objectView.viewTypeMapDesc') },
    { type: 'chart',    icon: BarChart3,        label: t('console.objectView.viewTypeChart'),    description: t('console.objectView.viewTypeChartDesc') },
  ];
}

/** Suggest a non-colliding default name like "Grid 1", "Grid 2", … */
function suggestName(typeLabel: string, existing: Set<string>): string {
  for (let i = 1; i < 1000; i++) {
    const candidate = `${typeLabel} ${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return typeLabel;
}

export function CreateViewDialog({
  open,
  onOpenChange,
  onCreate,
  existingLabels,
  availableTypes,
}: CreateViewDialogProps) {
  const { t } = useObjectTranslation();
  const allTypes = useMemo(() => buildViewTypeMeta(t), [t]);
  const types = useMemo(
    () => (availableTypes && availableTypes.length > 0
      ? allTypes.filter(v => availableTypes.includes(v.type))
      : allTypes),
    [allTypes, availableTypes],
  );
  const existingSet = useMemo(() => new Set(existingLabels ?? []), [existingLabels]);

  const [selectedType, setSelectedType] = useState<string>(types[0]?.type ?? 'grid');
  const [label, setLabel] = useState<string>('');
  const [touched, setTouched] = useState(false);

  // Reset when the dialog opens, and re-suggest name whenever type changes
  // (only while the user hasn't manually edited it yet).
  useEffect(() => {
    if (open) {
      setSelectedType(types[0]?.type ?? 'grid');
      setTouched(false);
    }
  }, [open, types]);

  useEffect(() => {
    if (!touched) {
      const meta = types.find(v => v.type === selectedType);
      setLabel(suggestName(meta?.label ?? 'View', existingSet));
    }
  }, [selectedType, touched, types, existingSet]);

  const trimmed = label.trim();
  const isDuplicate = trimmed.length > 0 && existingSet.has(trimmed);
  const canSubmit = trimmed.length > 0 && !isDuplicate;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onCreate({ type: selectedType, label: trimmed });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px]"
        data-testid="create-view-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('console.objectView.createView')}</DialogTitle>
          <DialogDescription>
            {t('console.objectView.createViewDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 py-2" data-testid="create-view-type-grid">
          {types.map(({ type, label: typeLabel, description, icon: Icon }) => {
            const selected = type === selectedType;
            return (
              <button
                key={type}
                type="button"
                data-testid={`create-view-type-${type}`}
                aria-pressed={selected}
                onClick={() => setSelectedType(type)}
                className={cn(
                  'group flex flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left transition-colors',
                  'hover:border-primary/60 hover:bg-accent/40',
                  selected
                    ? 'border-primary ring-2 ring-primary/30 bg-accent/40'
                    : 'border-border',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    selected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <div className="text-xs font-medium leading-tight">{typeLabel}</div>
                <div className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                  {description}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <label htmlFor="create-view-name-input" className="text-xs font-medium">
            {t('console.objectView.title')}
            <span className="ml-1 text-destructive">*</span>
          </label>
          <Input
            id="create-view-name-input"
            data-testid="create-view-name-input"
            autoFocus
            value={label}
            onChange={(e) => { setLabel(e.target.value); setTouched(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
            placeholder={t('console.objectView.newView')}
            className="h-9"
          />
          {isDuplicate && (
            <p className="text-[11px] text-destructive" data-testid="create-view-error-duplicate">
              {t('console.objectView.duplicateViewName')}
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="create-view-cancel"
          >
            {t('console.objectView.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="create-view-submit"
          >
            {t('console.objectView.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@object-ui/components';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { BulkActionDef, BulkActionParam } from '@object-ui/types';
import { useBulkExecutor, type BulkExecutorOptions, type BulkResult } from '../hooks/useBulkExecutor';

export interface BulkActionDialogProps {
  /** The action being executed. */
  def: BulkActionDef | null;
  /** Selected records to operate on. */
  rows: Array<Record<string, unknown>>;
  /** Object resource name (passed to the executor + lookup loader). */
  resource: string;
  /** Data source used by the executor + lookup-param loader. */
  dataSource: BulkExecutorOptions['dataSource'] & {
    find?: (
      resource: string,
      query?: Record<string, unknown>,
    ) => Promise<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;
  };
  /** Open state. */
  open: boolean;
  /** Close handler — invoked on Cancel, on overlay click, or after Done. */
  onClose: (result?: BulkResult | null) => void;
  /** Optional column to use as a row label in previews (defaults to 'name'). */
  labelKey?: string;
}

type Step = 'params' | 'confirm' | 'running' | 'result';

interface LookupOption {
  value: string;
  label: string;
}

/**
 * 4-step bulk action dialog. Resolves param values, lets the user confirm the
 * impact, executes via useBulkExecutor, then displays a success/failure
 * summary with a downloadable error list when applicable.
 */
export const BulkActionDialog: React.FC<BulkActionDialogProps> = ({
  def,
  rows,
  resource,
  dataSource,
  open,
  onClose,
  labelKey = 'name',
}) => {
  const params = def?.params ?? [];
  const initialParamValues = useMemo<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const p of params) {
      if (p.default !== undefined) v[p.name] = p.default;
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.name]);

  const [step, setStep] = useState<Step>('params');
  const [values, setValues] = useState<Record<string, unknown>>(initialParamValues);
  const [lookupCache, setLookupCache] = useState<Record<string, LookupOption[]>>({});
  const { run, progress, result, reset } = useBulkExecutor({ resource, dataSource });

  // Reset internal state whenever the dialog re-opens for a different action.
  useEffect(() => {
    if (!open) return;
    reset();
    setValues(initialParamValues);
    // Skip params step when nothing to collect.
    setStep(params.length === 0 ? 'confirm' : 'params');
  }, [open, def?.name, initialParamValues, params.length, reset]);

  // Eagerly load lookup options for any lookup param. Cheap for the MVP since
  // most CRM lookups (users, queues) cap out at a few hundred rows.
  useEffect(() => {
    if (!open) return;
    if (typeof dataSource.find !== 'function') return;
    const lookups = params.filter(p => p.type === 'lookup' && p.object && !lookupCache[p.name]);
    if (lookups.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, LookupOption[]> = {};
      for (const p of lookups) {
        try {
          const res = await dataSource.find!(p.object as string, { $top: 200 });
          const items = Array.isArray(res) ? res : (res?.data ?? []);
          next[p.name] = items.map(r => ({
            value: String(r.id ?? r._id ?? ''),
            label: String(r.name ?? r.full_name ?? r.email ?? r.id ?? '(unnamed)'),
          })).filter(o => o.value);
        } catch {
          next[p.name] = [];
        }
      }
      if (!cancelled) setLookupCache(prev => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, def?.name]);

  const paramsValid = useMemo(() => {
    for (const p of params) {
      if (p.required) {
        const v = values[p.name];
        if (v === undefined || v === null || v === '') return false;
      }
    }
    return true;
  }, [params, values]);

  const maxRecords = def?.maxRecords ?? Infinity;
  const overLimit = rows.length > maxRecords;

  const handleRun = useCallback(async () => {
    if (!def) return;
    setStep('running');
    await run(def, rows, values);
    setStep('result');
  }, [def, rows, values, run]);

  const downloadErrors = useCallback(() => {
    if (!result?.errors?.length) return;
    const header = 'record_id,error_message';
    const csv = [header, ...result.errors.map(e =>
      `${e.id},"${e.error.replace(/"/g, '""')}"`,
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_errors_${def?.name ?? 'action'}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, def?.name]);

  if (!def) return null;

  const title = def.label ?? def.name;
  const previewRows = rows.slice(0, 5);
  const restCount = Math.max(0, rows.length - previewRows.length);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(result); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
            {title}
          </DialogTitle>
          {step === 'confirm' && (
            <DialogDescription>
              {def.confirmText ?? `This will apply to ${rows.length} record${rows.length === 1 ? '' : 's'}.`}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'params' && (
          <div className="space-y-3">
            {params.map(p => (
              <ParamField
                key={p.name}
                param={p}
                value={values[p.name]}
                lookupOptions={lookupCache[p.name]}
                onChange={(v) => setValues(prev => ({ ...prev, [p.name]: v }))}
              />
            ))}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3 text-sm">
            {overLimit && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  Selection ({rows.length}) exceeds the action limit ({maxRecords}). Reduce the selection to proceed.
                </div>
              </div>
            )}
            <div className="text-muted-foreground">Affected records ({rows.length}):</div>
            <ScrollArea className="max-h-32 rounded border bg-muted/30 p-2">
              <ul className="text-xs space-y-1">
                {previewRows.map((r, i) => (
                  <li key={String(r.id ?? i)} className="truncate">
                    • {String(r[labelKey] ?? r.id ?? `Row ${i + 1}`)}
                  </li>
                ))}
                {restCount > 0 && (
                  <li className="text-muted-foreground">… and {restCount} more</li>
                )}
              </ul>
            </ScrollArea>
            {Object.keys(values).length > 0 && (
              <div className="rounded border bg-muted/30 p-2 text-xs space-y-0.5">
                {Object.entries(values).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-muted-foreground">{k}:</span> {formatValue(v)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'running' && (
          <div className="space-y-2">
            <Progress value={progress.total ? (progress.done + progress.failed) / progress.total * 100 : 0} />
            <div className="text-xs text-muted-foreground text-center">
              {progress.done + progress.failed} / {progress.total} processed
              {progress.failed > 0 && ` · ${progress.failed} failed`}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <span>
                Succeeded {result.succeeded} / {result.total}
                {result.failed > 0 && ` · Failed ${result.failed}`}
              </span>
            </div>
            {result.errors.length > 0 && (
              <>
                <ScrollArea className="max-h-32 rounded border bg-destructive/5 p-2">
                  <ul className="text-xs space-y-1">
                    {result.errors.slice(0, 8).map(e => (
                      <li key={e.id} className="flex gap-2">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
                        <span className="truncate">
                          <span className="text-muted-foreground">{e.id}:</span> {e.error}
                        </span>
                      </li>
                    ))}
                    {result.errors.length > 8 && (
                      <li className="text-muted-foreground">… and {result.errors.length - 8} more</li>
                    )}
                  </ul>
                </ScrollArea>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  Download error CSV
                </Button>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'params' && (
            <>
              <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
              <Button onClick={() => setStep('confirm')} disabled={!paramsValid}>Next</Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="ghost" onClick={() => params.length ? setStep('params') : onClose()}>
                {params.length ? 'Back' : 'Cancel'}
              </Button>
              <Button
                variant={def.variant === 'danger' ? 'destructive' : 'default'}
                onClick={handleRun}
                disabled={overLimit}
              >
                {def.confirmLabel ?? 'Run'}
              </Button>
            </>
          )}
          {step === 'running' && (
            <Button variant="ghost" disabled>
              Running…
            </Button>
          )}
          {step === 'result' && (
            <Button onClick={() => onClose(result)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

interface ParamFieldProps {
  param: BulkActionParam;
  value: unknown;
  onChange: (v: unknown) => void;
  lookupOptions?: LookupOption[];
}

const ParamField: React.FC<ParamFieldProps> = ({ param, value, onChange, lookupOptions }) => {
  const id = `bulk-param-${param.name}`;
  const label = (
    <Label htmlFor={id} className="text-xs">
      {param.label ?? param.name}
      {param.required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  let control: React.ReactNode = null;
  switch (param.type) {
    case 'boolean':
      control = (
        <Switch
          id={id}
          checked={!!value}
          onCheckedChange={onChange}
        />
      );
      break;
    case 'textarea':
      control = (
        <Textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={param.placeholder}
        />
      );
      break;
    case 'select': {
      const options = param.options ?? [];
      control = (
        <Select value={value !== undefined && value !== null ? String(value) : ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={param.placeholder ?? 'Select…'} />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => (
              <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }
    case 'lookup': {
      const opts = lookupOptions ?? [];
      control = (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={opts.length === 0 ? 'Loading…' : (param.placeholder ?? 'Select…')} />
          </SelectTrigger>
          <SelectContent>
            {opts.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }
    case 'number':
      control = (
        <Input
          id={id}
          type="number"
          value={(value as number | string) ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={param.placeholder}
        />
      );
      break;
    default:
      control = (
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={param.placeholder}
        />
      );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label}
      </div>
      {control}
      {param.help && <p className="text-[11px] text-muted-foreground">{param.help}</p>}
    </div>
  );
};
